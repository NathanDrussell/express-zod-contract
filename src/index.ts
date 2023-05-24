import type { Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

const $contractContext = {
  logger: undefined as LoggingFunction | undefined,
};

const LogLevels = {
  debug: 0,
  info: 1,
  error: 2,
  warn: 3,
} as const;

type LogLevel = keyof typeof LogLevels;

type LogParams = {
  level: LogLevel;
  message: string;
  tags: string[];
  metadata: Record<string, string>;
};

type ContractOutput = {
  log: (params: LogParams) => void;
  error: (message: string, code: number) => void;
};

type ContractInput<
  TQuery extends z.Schema<unknown>,
  TParams extends z.Schema<unknown>,
  TBody extends z.Schema<unknown>,
  THeaders extends z.Schema<unknown>,
  TResult extends z.Schema<unknown>,
  Query = z.infer<TQuery>,
  Params = z.infer<TParams>,
  Body = z.infer<TBody>,
  Result = z.infer<TResult>,
  Headers = z.infer<THeaders>
> = {
  query?: TQuery;
  params?: TParams;
  body?: TBody;
  headers?: THeaders;
  result?: TResult;
  handler: (inputs: { query: Query; params: Params; body: Body; headers: Headers }, ctx: ContractOutput) => Promise<Result>;

  onUnexpectedError?: (error: unknown) => Promise<void>;
  beforeResponse?: (result: Result) => Promise<void>;
};

export class ContractError extends Error {
  constructor(message: string, public code: number) {
    super(message);
  }
}

type ContractFn = <
  TQuery extends z.Schema<unknown>,
  TParams extends z.Schema<unknown>,
  TBody extends z.Schema<unknown>,
  TResult extends z.Schema<unknown>,
  THeaders extends z.Schema<unknown>
>(
  contactInput: ContractInput<TQuery, TParams, TBody, THeaders, TResult>
) => (req: Request, res: Response) => void;

export const contract: ContractFn = (contract) => {
  return async (req, res) => {
    const logs: LogParams[] = [];
    try {
      const query = contract.query ? contract.query.parse(req.query) : req.query;
      const params = contract.params ? contract.params.parse(req.params) : req.params;
      const body = contract.body ? contract.body.parse(req.body) : req.body;
      const headers = contract.headers ? contract.headers.parse(req.headers) : z.record(z.string()).parse(req.headers);

      const inputs = {
        query,
        params,
        body,
        headers,
      };

      const ctx: ContractOutput = {
        log: (params) => void logs.push(params),
        error: (message, code = 400) => {
          throw new ContractError(message, code);
        },
      };

      const data = await contract.handler(inputs, ctx);

      if (contract.beforeResponse) {
        await contract.beforeResponse(data).catch((e) => {
          console.error("Error occured in beforeResponse hook:", e.stack);
        });
      }

      res.json({
        ok: true,
        data,
        errors: [],
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error, { issueSeparator: ";;;" });
        res.json({
          ok: false,
          data: null,
          errors: validationError.message.split(";;;"),
        });
      } else if (error instanceof ContractError) {
        res.json({
          ok: false,
          data: null,
          errors: [error.message],
        });
      } else {
        if (contract.onUnexpectedError) {
          await contract.onUnexpectedError(error).catch((e) => {
            console.error("Error occured in onUnexpectedError hook:", e.stack);
          });
        }

        res.json({
          ok: false,
          data: null,
          errors: ["Something went wrong"],
        });
      }
    } finally {
      if ($contractContext.logger)
        await $contractContext.logger(logs).catch((e) => {
          console.error("Error occured in logger:", e.stack);
        });
      else console.log("No logger defined");
    }
  };
};

export type LoggingFunction = (params: LogParams[]) => Promise<void>;

export const defineLogger = (fn: LoggingFunction) => {
  $contractContext.logger = fn;
};
