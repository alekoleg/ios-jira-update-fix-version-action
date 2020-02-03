const assert = require("assert");
const { inspect } = require("util");

const { command } = require("execa");
const core = require("@actions/core");
const { request } = require("@octokit/request");
const JiraClient = require("jira-connector");

main();

async function main() {
  if (!process.env.GITHUB_TOKEN) {
    core.setFailed(
      `GITHUB_TOKEN is not configured. Make sure you made it available to your action
  
  uses: bolteu/ios-jira-update-fix-version-action@master
  env:
    GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}`
    );
    return;
  }

  if (!process.env.GITHUB_REPOSITORY) {
    core.setFailed(
      'GITHUB_REPOSITORY missing, must be set to "<repo owner>/<repo name>"'
    );
    return;
  }
  if (!process.env.GITHUB_REF) {
    core.setFailed(
      "GITHUB_REF missing, must be set to the repository's default branch"
    );
    return;
  }

  try {
    const inputs = {
      ticketRegexp: core.getInput("ticketRegexp"),
      targetBranch: core.getInput("targetBranch"),
      jiraAccount: core.getInput("jiraAccount"),
      jiraToken: core.getInput("jiraToken"),
      jiraHost: core.getInput("jiraHost"),
      projectName: core.getInput("projectName"),
      versionSuffix: core.getInput("versionSuffix"),
      jiraProjectIds: core.getInput("jiraProjectIds").split(",")
    };

    core.debug(`Inputs: ${inspect(inputs)}`);

    await runShellCommand(`git fetch origin ${inputs.targetBranch}`)
    await runShellCommand(`git fetch origin ${process.env.GITHUB_REF}`)

    const commits = await runShellCommand(`git log --pretty=oneline --no-merges origin/${inputs.targetBranch}..HEAD`);

    const regexp = new RegExp(inputs.ticketRegexp, "gmi")
    core.info("olololol")
    core.info(regexp)
    // const regexp = /${inputs.targetBranch} -\d{1,}/gmi
    // const regexp = /(CLIENTAPP|RNTL|MTL)-\d{1,}/gmi
    const matches = commits.match(regexp)

    core.info("Commits: " + JSON.stringify(matches));

    var version = await runShellCommand(`sed -n '/MARKETING_VERSION/{s/MARKETING_VERSION = //;s/;//;s/^[[:space:]]*//;p;q;}' ./mTakso.xcodeproj/project.pbxproj`)
    version = `${inputs.versionSuffix}.${version}`
    core.info("Version number is " + version)


    var jira = new JiraClient({
      host: inputs.jiraHost,
      basic_auth: {
        email: inputs.jiraAccount,
        api_token: inputs.jiraToken
      },
      strictSSL: true
    });

    
    for (var i = inputs.jiraProjectIds.length - 1; i >= 0; i--) {
      const project = inputs.jiraProjectIds[i]
      await jira.version.createVersion({ projectId : project, name: "CI.4.99"}).catch(function(error) {
        core.info(error)
      });

    }

    for (var i = matches.length - 1; i >= 0; i--) {
      const tiket = matches[i]
      const issue = await jira.issue.getIssue({ issueKey: element });  
      core.info("Issue : " + element)
      
      core.info("Issue version: " + JSON.stringify(issue.fields.fixVersions))
    }  

  } catch (error) {
    core.debug(inspect(error));
    core.setFailed(error.message);
  }
}

async function runShellCommand(commandString) {
  core.debug(`$ ${commandString}`);
  try {
    const { stdout, stderr } = await command(commandString, { shell: true });
    const output = [stdout, stderr].filter(Boolean).join("\n");
    core.debug(output);
    return output;
  } catch (error) {
    core.debug(inspect(error));
    throw error;
  }
}


