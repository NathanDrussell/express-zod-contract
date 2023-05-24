# Express zod contract

## Installation

```sh
# npm
npm i express-zod-contract

# yarn
yarn add express-zod-contract

# pnpm
yarn add express-zod-contract
```

## Examples

With the type inference, it's pretty straight forward how it works.

```typescript
import * as express from "express";
import { contract } from "express-zod-contract";
import { z } from "zod";

const app = express();

app.get(
  "/:name",
  contract({
    params: z.object({
      name: z.string().max(10),
    }),
    result: z.string(),
    handler: (inputs, ctx) => {
      return { greeting: "Hello " + inputs.name };
    },
  })
);

app.listen(3000, () => console.log("Server listening on http://localhost:3000"));
```
