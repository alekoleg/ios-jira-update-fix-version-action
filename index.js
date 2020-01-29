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


    var jira = new JiraClient({
      host: inputs.jiraHost,
      basic_auth: {
        email: inputs.jiraAccount,
        api_token: inputs.jiraToken
      },
      strictSSL: true
    });

    matches.forEach(async element => {
      const issue = await jira.issue.getIssue({ issueKey: element });  
      core.info(`Issue version: ${issue.fields.fixVersions}`)
    })
    const issue = await jira.issue.getIssue({ issueKey: "CLIENTAPP-1000" });
    core.info(`Issue version: ${issue.fields.fixVersions}`)

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
