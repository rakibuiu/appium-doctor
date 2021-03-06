// transpile:mocha

import { fixes, XcodeCheck, XcodeCmdLineToolsCheck, DevToolsSecurityCheck,
  AuthorizationDbCheck, CarthageCheck } from '../lib/ios';
import { fs, system } from 'appium-support';
import * as utils from '../lib/utils';
import * as tp from 'teen_process';
import * as prompter from '../lib/prompt';
import CarthageDetector from '../lib/carthage-detector';
import FixSkippedError from '../lib/doctor';
import log from '../lib/logger';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import B from 'bluebird';
import { withMocks, withSandbox, stubLog } from 'appium-test-support';


chai.should();
chai.use(chaiAsPromised);

describe('ios', function () {
  describe('XcodeCheck', withMocks({tp, fs}, (mocks) => {
    let check = new XcodeCheck();
    it('autofix', function () {
      check.autofix.should.not.be.ok;
    });
    it('diagnose - success', async function () {
      mocks.tp.expects('exec').once().returns(
        B.resolve({stdout: '/a/b/c/d\n', stderr: ''}));
      mocks.fs.expects('exists').once().returns(B.resolve(true));
      (await check.diagnose()).should.deep.equal({
        ok: true,
        message: 'Xcode is installed at: /a/b/c/d'
      });
      mocks.verify();
    });
    it('diagnose - failure - xcode-select', async function () {
      mocks.tp.expects('exec').once().returns(B.reject(new Error('Something wrong!')));
      (await check.diagnose()).should.deep.equal({
        ok: false,
        message: 'Xcode is NOT installed!'
      });
      mocks.verify();
    });
    it('diagnose - failure - path not exists', async function () {
      mocks.tp.expects('exec').once().returns(
        B.resolve({stdout: '/a/b/c/d\n', stderr: ''}));
      mocks.fs.expects('exists').once().returns(B.resolve(false));
      (await check.diagnose()).should.deep.equal({
        ok: false,
        message: 'Xcode cannot be found at \'/a/b/c/d\'!'
      });
      mocks.verify();
    });
    it('fix', async function () {
      (await check.fix()).should.equal('Manually install Xcode.');
    });
  }));
  describe('XcodeCmdLineToolsCheck', withSandbox({mocks: {tp, utils, prompter, system}}, (S) => {
    let check = new XcodeCmdLineToolsCheck();
    it('autofix', function () {
      check.autofix.should.be.ok;
    });
    it('diagnose - success', async function () {
      S.mocks.system.expects('macOsxVersion').once().returns(B.resolve('10.10'));
      S.mocks.tp.expects('exec').once().returns(
        B.resolve({stdout: '1234 install-time\n', stderr: ''}));
      (await check.diagnose()).should.deep.equal({
        ok: true,
        message: 'Xcode Command Line Tools are installed.'
      });
      S.verify();
    });
    it('diagnose - failure - pkgutil crash', async function () {
      S.mocks.system.expects('macOsxVersion').once().returns(B.resolve('10.10'));
      S.mocks.tp.expects('exec').once().throws(new Error('Something wrong!'));
      (await check.diagnose()).should.deep.equal({
        ok: false,
        message: 'Xcode Command Line Tools are NOT installed!'
      });
      S.verify();
    });
    it('diagnose - failure - no install time', async function () {
      S.mocks.system.expects('macOsxVersion').once().returns(B.resolve('10.10'));
      S.mocks.tp.expects('exec').once().returns(
        B.resolve({stdout: '1234 abcd\n', stderr: ''}));
      (await check.diagnose()).should.deep.equal({
        ok: false,
        message: 'Xcode Command Line Tools are NOT installed!'
      });
      S.verify();
    });
    it('fix - yes', async function () {
      let logStub = stubLog(S.sandbox, log, {stripColors: true});
      S.mocks.tp.expects('exec').once().returns(
        B.resolve({stdout: '', stderr: ''}));
      S.mocks.prompter.expects('fixIt').once().returns(B.resolve('yes'));
      await check.fix();
      S.verify();
      logStub.output.should.equal([
        'info: The following command need be executed: xcode-select --install',
      ].join('\n'));
    });
    it('fix - no', async function () {
      let logStub = stubLog(S.sandbox, log, {stripColors: true});
      S.mocks.tp.expects('exec').never();
      S.mocks.prompter.expects('fixIt').once().returns(B.resolve('no'));
      await check.fix().should.be.rejectedWith(FixSkippedError);
      S.verify();
      logStub.output.should.equal([
        'info: The following command need be executed: xcode-select --install',
        'info: Skipping you will need to install Xcode manually.'
      ].join('\n'));
    });
  }));

  describe('authorizeIosFix', withSandbox({mocks: {utils, prompter}}, (S) => {
    it('fix - yes', async function () {
      let logStub = stubLog(S.sandbox, log, {stripColors: true});
      S.mocks.utils.expects('authorize').once();
      S.mocks.prompter.expects('fixIt').once().returns(B.resolve('yes'));
      await fixes.authorizeIosFix();
      S.verify();
      logStub.output.should.equal([
        'info: The authorize iOS script need to be run.',
      ].join('\n'));
    });
    it('fix - no', async function () {
      let logStub = stubLog(S.sandbox, log, {stripColors: true});
      S.mocks.utils.expects('authorize').never();
      S.mocks.prompter.expects('fixIt').once().returns(B.resolve('no'));
      await fixes.authorizeIosFix().should.be.rejectedWith(FixSkippedError);
      S.verify();
      logStub.output.should.equal([
        'info: The authorize iOS script need to be run.',
        'info: Skipping you will need to run the authorize iOS manually.'
      ].join('\n'));
    });
  }));
  describe('DevToolsSecurityCheck', withMocks({fixes, tp}, (mocks) => {
    let check = new DevToolsSecurityCheck();
    it('autofix', function () {
      check.autofix.should.be.ok;
    });
    it('diagnose - success', async function () {
      mocks.tp.expects('exec').once().returns(
        B.resolve({stdout: '1234 enabled\n', stderr: ''}));
      (await check.diagnose()).should.deep.equal({
        ok: true,
        message: 'DevToolsSecurity is enabled.'
      });
      mocks.verify();
    });
    it('diagnose - failure - DevToolsSecurity crash', async function () {
      mocks.tp.expects('exec').once().returns(B.reject(new Error('Something wrong!')));
      (await check.diagnose()).should.deep.equal({
        ok: false,
        message: 'DevToolsSecurity is NOT enabled!'
      });
      mocks.verify();
    });
    it('diagnose - failure - not enabled', async function () {
      mocks.tp.expects('exec').once().returns(
        B.resolve({stdout: '1234 abcd\n', stderr: ''}));
      (await check.diagnose()).should.deep.equal({
        ok: false,
        message: 'DevToolsSecurity is NOT enabled!'
      });
      mocks.verify();
    });
    it('fix', async function () {
      mocks.fixes.expects('authorizeIosFix').once();
      await check.fix();
      mocks.verify();
    });
  }));
  describe('AuthorizationDbCheck', withMocks({fixes, tp, fs, utils, system}, (mocks) => {
    let check = new AuthorizationDbCheck();
    it('autofix', function () {
      check.autofix.should.be.ok;
    });
    it('diagnose - success - 10.10', async function () {
      mocks.tp.expects('exec').once().returns(
        B.resolve({stdout: '1234 is-developer\n', stderr: ''}));
      (await check.diagnose()).should.deep.equal({
        ok: true,
        message: 'The Authorization DB is set up properly.'
      });
      mocks.verify();
    });
    it('diagnose - success - 10.8', async function () {
      mocks.tp.expects('exec').once().returns(B.reject(new Error('Oh No!')));
      mocks.system.expects('macOsxVersion').once().returns(B.resolve('10.8'));
      mocks.fs.expects('readFile').once().returns(B.resolve(
        '<key>system.privilege.taskport</key> \n <dict>\n <key>allow-root</key>\n <true/>'));
      (await check.diagnose()).should.deep.equal({
        ok: true,
        message: 'The Authorization DB is set up properly.'
      });
      mocks.verify();
    });
    it('diagnose - failure - 10.10 - security', async function () {
      mocks.tp.expects('exec').once().returns(B.reject(new Error('Oh No!')));
      mocks.system.expects('macOsxVersion').once().returns(B.resolve('10.10'));
      (await check.diagnose()).should.deep.equal({
        ok: false,
        message: 'The Authorization DB is NOT set up properly.'
      });
      mocks.verify();
    });
    it('diagnose - failure - /etc/authorization', async function () {
      mocks.tp.expects('exec').once().returns(B.reject(new Error('Oh No!')));
      mocks.system.expects('macOsxVersion').once().returns(B.resolve('10.8'));
      mocks.fs.expects('readFile').once().returns(B.resolve(''));
      (await check.diagnose()).should.deep.equal({
        ok: false,
        message: 'The Authorization DB is NOT set up properly.'
      });
      mocks.verify();
    });
    it('fix', async function () {
      mocks.fixes.expects('authorizeIosFix').once();
      await check.fix();
      mocks.verify();
    });
  }));
  describe('CarthageCheck', withMocks({CarthageDetector}, (mocks) => {
    let check = new CarthageCheck();
    it('autofix', function () {
      check.autofix.should.not.be.ok;
    });
    it('diagnose - success', async function () {
      mocks.CarthageDetector.expects('detect').once().returns(B.resolve('/usr/local/bin/carthage'));
      (await check.diagnose()).should.deep.equal({
        ok: true,
        message: 'Carthage was found at: /usr/local/bin/carthage'
      });
      mocks.verify();
    });
    it('diagnose - failure', async function () {
      mocks.CarthageDetector.expects('detect').once().returns(B.resolve(null));
      (await check.diagnose()).should.deep.equal({
        ok: false,
        message: 'Carthage was NOT found!'
      });
      mocks.verify();
    });
    it('fix', async function () {
      (await check.fix()).should.equal('Please install Carthage. Visit https://github.com/Carthage/Carthage#installing-carthage for more information.');
    });
  }));
});
