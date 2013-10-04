/*
 * grunt-version-build
 * https://github.com/robwierzbowski/grunt-version-build
 *
 * Copyright (c) 2013 Rob Wierzbowski
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {
  var fs = require('fs');
  var path = require('path');
  var shelljs = require('shelljs');


  grunt.registerMultiTask('version_build', 'Work with branches that version a single directory.', function() {

    var done = this.async();
    var options = this.options({
      commit: false,
      // tag: false,
      push: false,
      commitMsg: 'Built from %sourceName%, commit %sourceCommit% on branch %sourceBranch%',
      force: false
    });
    var sourceInfo = {};

    // Check requirements
    function checkRequirements (next) {
      // Check that required options are set.
      ['branch', 'dir', 'remote'].forEach( function (element) {
        if (!options.hasOwnProperty(element)) {
          grunt.fail.warn('The "' + element + '" option is required.');
          return false;
        }
      });

      // Check that the dist directory exists
      if(!shelljs.test('-d', options.dir)) {
        grunt.log.writeln('The target directory "' + options.dir + '" doesn\'t exist. Creating it.');

        if(shelljs.mkdir(options.dir)) {
          grunt.fail.warn('Unable to create the target directory "' + options.dir + '".');
          return false;
        }
      }

      return true;
    }

    // Initialize git repo if one doesn't exist
    function initGit () {
      if(!shelljs.test('-d', path.join(options.dir, '.git'))) {
        grunt.log.writeln("Creating local git repo.");

        if(shelljs.exec('git init').code !== 0) {
          grunt.fail.warn("Could not initialize the local git repo.");
          return false;
        }
      }

      return true;
    }

    // Create the portal branch if it doesn't exist
    function initBranch () {
      if(shelljs.exec('git show-ref --verify --quiet refs/heads/' + options.branch).code === 0) {
        return true;
      }

      if(shelljs.exec('git checkout --orphan ' + options.branch).code !== 0) {
        grunt.fail.warn("Could not create branch.");
        return false;
      }

      grunt.log.writeln('Checking to see if the branch exists remotely...');

      if(shelljs.exec('git ls-remote --exit-code ' + options.remote + ' ' + options.branch).code === 0) {
        grunt.log.writeln('Remote branch exists.');
        return true;
      }

      grunt.log.writeln('Remote branch does not exist. Adding an initial commit.');
      if(shelljs.exec('git commit --allow-empty -m "Initial Commit."').code !== 0) {
        grunt.log.writeln('Could not create an initial commit.');
        return false;
      }

      if(shelljs.exec('git push --set-upstream ' + options.remote + ' HEAD:' + options.branch).code !== 0) {
        grunt.log.writeln('Could not push initial branch.');
        return false;
      }

      return true;
    }

    // Make the current working tree the branch HEAD without checking out files
    function safeCheckout () {
      grunt.log.writeln('Pulling latest from remote.');

      if(shelljs.exec('git pull ' + options.remote + ' ' + options.branch).code !== 0) {
        grunt.log.writeln('Could not pull local branch.');
        return false;
      }

      return true;
    }

    // Stage and commit to a branch
    function gitCommit () {
    // TODO: Pull/fetch before each commit
      var commitMsg;

      // Unstage any changes, just in case
      if(shelljs.exec('git reset').code !== 0) {
        grunt.log.writeln('Could not unstage local changes.');
      }

      // Make sure there are differneces to commit
      var status = shelljs.exec('git status --porcelain');

      if(status.code !== 0) {
        grunt.log.writeln('Could not execute git status.');
        return false;
      }

      if (status.output === '') {
        // No changes, skip commit
        grunt.log.writeln('There have been no changes, skipping commit.'); //// reword
        return true;
      }

      // Parse tokens in commit message
      commitMsg = options.commitMsg
        .replace(/%sourceCommit%/g, sourceInfo.commit)
        .replace(/%sourceBranch%/g, sourceInfo.branch);

      // Stage and commit
      if(shelljs.exec('git add -A . && git commit -m "' + commitMsg + '"').code !== 0) {
        grunt.log.writeln('Unable to commit changes locally.');
        return false;
      }

      grunt.log.writeln('Committed changes to branch "' + options.branch + '".');
      return true;
    }

    // Push portal branch to the remote
    function gitPush () {
      var args = '';

      // TODO: Implement force push
      if(shelljs.exec('git push ' + args + options.remote + ' HEAD:' + options.branch).code !== 0) {
        grunt.log.writeln('Unable to push changes to remote.');
        return false;
      }

      // TODO: Give good error messages:
      // - if push doesn't work because of network ?
      // - if push doesn't work because of repo - fix yo shit

      grunt.log.writeln('Pushed ' + options.branch + ' to ' + options.remote);
      return true;
    }

    var currentDir = pwd();

    try {

      if(!checkRequirements()) {
        done(false);
        return;
      }

      // Change working directory
      shelljs.cd(options.dir);

      if(!initGit()) {
        done(false);
        return;
      }

      if(!initBranch()) {
        done(false);
        return;
      }

      if(!safeCheckout()) {
        done(false);
        return;
      }

      if (options.commit === false && options.push === false) {
        done(true);
        return;
      }

      if(!gitCommit()) {
        done(false);
        return;
      }

      if (options.push === false) {
        done(true);
        return;
      }

      if(!gitPush()) {
        done(false);
        return;
      }

      done(true);
    }
    finally {
      cd(currentDir);
    }
  });
};
