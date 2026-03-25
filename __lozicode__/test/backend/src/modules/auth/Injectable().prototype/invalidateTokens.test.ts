
import { Injectable() } from "../../../../../../../backend/src/modules/auth/token.service"
import { mockAll, readOutput } from '../../../../../../../__lozicode__/mock';

mockAll();

describe("Injectable().invalidateTokens", () =>  {
  it("default", async () => {
    const actualOutput = await Injectable().prototype.invalidateTokens(null, null);
    console.log(actualOutput);
    // readOutput('Injectable().prototype/invalidateTokens/default')
  });
})