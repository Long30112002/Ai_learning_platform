
import { Injectable() } from "../../../../../../../backend/src/modules/auth/auth.service"
import { mockAll, readOutput } from '../../../../../../../__lozicode__/mock';

mockAll();

describe("Injectable().confirmEmailChange", () =>  {
  it("default", async () => {
    const actualOutput = await Injectable().prototype.confirmEmailChange(null);
    console.log(actualOutput);
    // readOutput('Injectable().prototype/confirmEmailChange/default')
  });
})