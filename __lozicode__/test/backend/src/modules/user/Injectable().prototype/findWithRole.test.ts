
import { Injectable() } from "../../../../../../../backend/src/modules/user/user.service"
import { mockAll, readOutput } from '../../../../../../../__lozicode__/mock';

mockAll();

describe("Injectable().findWithRole", () =>  {
  it("default", async () => {
    const actualOutput = await Injectable().prototype.findWithRole(null);
    console.log(actualOutput);
    // readOutput('Injectable().prototype/findWithRole/default')
  });
})