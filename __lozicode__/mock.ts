import { Injectable() } from "../backend/src/modules/auth/auth.service";
import { Injectable() } from "../backend/src/modules/email/email.service";
import { Injectable() } from "../backend/src/modules/auth/token.service";
import { Injectable() } from "../backend/src/modules/user/user.service";
import { mock, init } from './core';
import * as fse from 'fs-extra';


export function mockAll() {
  mock(Injectable().prototype, {
    functionName: 'confirmEmailChange', targetName: 'Injectable().prototype'
  });

  mock(Injectable().prototype, {
    functionName: 'revokeEmailChangeRequests', targetName: 'Injectable().prototype'
  });

  mock(Injectable().prototype, {
    functionName: 'invalidateTokens', targetName: 'Injectable().prototype'
  });

  mock(Injectable().prototype, {
    functionName: 'findWithRole', targetName: 'Injectable().prototype'
  });

  init();
}

export function readOutput(path) {
  const outputPath = `output/${path}`;
  if(fse.existsSync(`${outputPath}.html`)) {
    return fse.readFileSync(`${outputPath}.html`);
  }
  if(fse.existsSync(`${outputPath}.json`)) {
    return fse.readJsonSync(`${outputPath}.json`);
  }
}

