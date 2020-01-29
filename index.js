const assert = require("assert");
const { inspect } = require("util");

const { command } = require("execa");
const core = require("@actions/core");
const { request } = require("@octokit/request");
const JiraApi = require('jira-client');
const simpleGit = require('simple-git/promise');
const git = simpleGit();

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
      tiketRegexp: core.getInput("ticketRegexp"),
      targetBranch: core.getInput("targetBranch")
    };

    core.debug(`Inputs: ${inspect(inputs)}`);

    await runShellCommand(`git fetch origin ${inputs.targetBranch}`)
    await runShellCommand(`git fetch origin ${process.env.GITHUB_REF}`)

    // const commits = await runShellCommand(`git log --pretty=oneline --no-merges origin/${inputs.targetBranch}..${process.env.GITHUB_REF}`);

    const commits = await git.log([
      `--no-merges`,
      `${process.env.GITHUB_REF}..origin/${inputs.targetBranch}`,
    ])
    core.info("Commits: " + JSON.stringify(commits));
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
