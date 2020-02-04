const assert = require("assert");
const { inspect } = require("util");

const { command } = require("execa");
const core = require("@actions/core");
const { request } = require("@octokit/request");
const JiraClient = require("jira-connector");

import {context, GitHub} from '@actions/github'

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
  if (!process.env.GITHUB_HEAD_REF) {
    core.setFailed(
      "GITHUB_HEAD_REF missing, must be set to the repository's default branch"
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

    const token = core.getInput('github-token', {required: true})
    const client = new GitHub(token, { })

    // checking the branch
    const brachRegexp = new RegExp(`release\/${inputs.versionSuffix}.\\d{1,2}.\\d{1,3}`)
    const brachVerification = process.env.GITHUB_HEAD_REF.match(/release/gmi)
    if (brachVerification.length == 0) {
      const body = `Wrong brach format. Please fix it. Expected format is ${JSON.stringify(brachRegexp)}`
      await client.issues.createComment({...context.issue, body: body})
      throw "Wrong branch format"
    }

    await runShellCommand(`git fetch origin ${inputs.targetBranch}`)
    await runShellCommand(`git fetch origin ${process.env.GITHUB_HEAD_REF}`)

    const commits = await runShellCommand(`git log --pretty=oneline --no-merges origin/${inputs.targetBranch}..${process.env.GITHUB_HEAD_REF}`);

    const regexp = new RegExp(inputs.ticketRegexp, "gmi")
    core.info(regexp)
    
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
      core.info(`Creating ${version} for project -> ${project}` )
      await jira.version.createVersion({ projectId : project, name: version }).catch(function(error) {
        core.info(error)
      });

    }

    var errors = []
    for (var i = matches.length - 1; i >= 0; i--) {
      const ticket = matches[i]
      core.info(`Updating ticket -> ${ticket}` )
      await jira.issue.editIssue({
        issueKey: `${ticket}`,
        issue: {
          update: {
            fixVersions: [
              {"add" : { name : `${version}` }}
            ]
          }
        }
      }).catch(function(error) {
        core.info(error)
        // clear headers
        var printableError = JSON.parse(error)
        printableError.headers = null
        printableError.issue = printableError.request.uri.path
        printableError.request = null
        errors.push(JSON.stringify(printableError))
      })
    }  

    const urls = inputs.jiraProjectIds.map(id => `https:\/\/${inputs.jiraHost}\/projects\/${id}?selectedItem=com.atlassian.jira.jira-projects-plugin%3Arelease-page`)
    var body = `Ticket has been updated 🎉 \n please review it: \n ${urls.join("\n")}`
    if (errors.length > 0) {
      body = body + `\n\n🆘 There are errors while updating: \n\n ${errors.join("\n\n")}`
    }
    await client.issues.createComment({...context.issue, body: body})

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


