
import { Injectable() } from "../../../../../../../backend/src/modules/email/email.service"
import { mockAll, readOutput } from '../../../../../../../__lozicode__/mock';

mockAll();

describe("Injectable().revokeEmailChangeRequests", () =>  {
  it("default", async () => {
    const actualOutput = await Injectable().prototype.revokeEmailChangeRequests(null);
    console.log(actualOutput);
    // readOutput('Injectable().prototype/revokeEmailChangeRequests/default')
  });
})