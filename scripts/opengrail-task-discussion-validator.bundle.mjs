/** Generated from unchanged OpenGrail models. Source snapshot ebf6ddb3ab4a19d8fb29783a83e60b1ab9e417c5e5ad96bb8f6ec42266827d7d. Build inputs SHA-256 22397f272e93086bf57c647ae5e926345aab49edcb295c54d7064e25ba19c39e. */
/* Zod 3.25.76 license, retained verbatim:
MIT License

Copyright (c) 2025 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind2, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: kind2,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind2, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: kind2,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// app/venture-model.ts
var ventureLimits = { sources: 8, factText: 800, founders: 5, traction: 6, risks: 5, riskText: 500, catalystText: 500, issuerName: 120, url: 2048, maximumMoney: 1e15 };
var ventureScoreWeights = { founders: 15, technology: 15, market: 15, traction: 15, defensibility: 10, valuation: 10, timing: 5, accessibility: 10, asymmetry: 5 };
function ventureCredentialLike(raw) {
  let value = raw;
  for (let pass = 0; pass < 4; pass++) {
    if (/og_agent_|og_local_(?:owner|producer)_|gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}/i.test(value)) return true;
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }
  return false;
}
var text = (maximum, minimum = 1) => external_exports.string().trim().min(minimum).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine((value) => !ventureCredentialLike(value), "Credentials cannot be published.");
var ventureDateSchema = external_exports.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const at = Date.parse(value + "T00:00:00.000Z");
  return Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === value;
}, "Use a canonical calendar date.");
var ventureUrlSchema = text(ventureLimits.url).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use a credential-free HTTPS URL.");
var ventureClassificationSchema = external_exports.enum(["REPORTED_FACT", "FOUNDER_CLAIM", "ESTIMATE", "SPECULATION"]);
var ventureSourceIndicesSchema = external_exports.array(external_exports.number().int().min(0).max(ventureLimits.sources - 1)).min(1).max(ventureLimits.sources).refine((value) => new Set(value).size === value.length, "Source indices must be unique.");
var unknownSchema = external_exports.object({ state: external_exports.literal("UNKNOWN") }).strict();
var evidenceFields = { classification: ventureClassificationSchema, asOf: ventureDateSchema, sourceIndices: ventureSourceIndicesSchema };
var ventureReportedFactSchema = external_exports.object({ state: external_exports.literal("REPORTED"), value: text(ventureLimits.factText), ...evidenceFields }).strict();
var ventureFactSchema = external_exports.discriminatedUnion("state", [unknownSchema, ventureReportedFactSchema]);
var ventureCurrencySchema = external_exports.enum(["EUR", "USD", "GBP", "CHF"]);
var ventureValuationBasisSchema = external_exports.enum(["PRE_MONEY", "POST_MONEY", "FDV", "MARKET_CAP", "UNKNOWN"]);
var ventureReportedMoneySchema = external_exports.object({ state: external_exports.literal("REPORTED"), amount: external_exports.number().finite().nonnegative().max(ventureLimits.maximumMoney), currency: ventureCurrencySchema, ...evidenceFields }).strict();
var ventureMoneySchema = external_exports.discriminatedUnion("state", [unknownSchema, ventureReportedMoneySchema]);
var ventureReportedValuationSchema = external_exports.object({ state: external_exports.literal("REPORTED"), amount: external_exports.number().finite().positive().max(ventureLimits.maximumMoney), currency: ventureCurrencySchema, basis: ventureValuationBasisSchema, ...evidenceFields }).strict();
var ventureValuationSchema = external_exports.discriminatedUnion("state", [unknownSchema, ventureReportedValuationSchema]);
var ventureAccessSchema = external_exports.discriminatedUnion("status", [
  external_exports.object({ status: external_exports.literal("UNKNOWN"), asOf: external_exports.null(), sourceIndices: external_exports.array(external_exports.never()).length(0), route: external_exports.null(), conditions: external_exports.literal("") }).strict(),
  external_exports.object({ status: external_exports.enum(["YES", "MAYBE", "NO"]), asOf: ventureDateSchema, sourceIndices: ventureSourceIndicesSchema, route: ventureUrlSchema.nullable(), conditions: text(ventureLimits.factText) }).strict()
]);
var ventureIssuerSchema = external_exports.object({
  name: text(ventureLimits.issuerName),
  website: ventureUrlSchema,
  kind: external_exports.enum(["COMPANY", "TOKEN", "PROJECT"]),
  sector: external_exports.enum(["AI", "AGENTS", "DEVELOPER_INFRA", "AUTOMATION", "ROBOTICS", "COMPUTE", "CYBERSECURITY", "DATA_INFRA", "VERTICAL_SAAS", "DEEP_TECH", "OPEN_SOURCE", "CRYPTO_INFRA", "OTHER"]),
  stage: external_exports.enum(["IDEA", "PRE_SEED", "SEED", "SERIES_A", "PUBLIC", "UNKNOWN"])
}).strict();
var ventureScoreComponentsSchema = external_exports.object({
  founders: external_exports.number().int().min(0).max(ventureScoreWeights.founders).nullable(),
  technology: external_exports.number().int().min(0).max(ventureScoreWeights.technology).nullable(),
  market: external_exports.number().int().min(0).max(ventureScoreWeights.market).nullable(),
  traction: external_exports.number().int().min(0).max(ventureScoreWeights.traction).nullable(),
  defensibility: external_exports.number().int().min(0).max(ventureScoreWeights.defensibility).nullable(),
  valuation: external_exports.number().int().min(0).max(ventureScoreWeights.valuation).nullable(),
  timing: external_exports.number().int().min(0).max(ventureScoreWeights.timing).nullable(),
  accessibility: external_exports.number().int().min(0).max(ventureScoreWeights.accessibility).nullable(),
  asymmetry: external_exports.number().int().min(0).max(ventureScoreWeights.asymmetry).nullable()
}).strict();
var dossierBodySchema = external_exports.object({
  issuer: ventureIssuerSchema,
  asOf: ventureDateSchema,
  product: ventureFactSchema,
  customer: ventureFactSchema,
  competition: ventureFactSchema,
  edge: ventureFactSchema,
  funding: ventureFactSchema,
  dilution: ventureFactSchema,
  founders: external_exports.array(ventureReportedFactSchema).max(ventureLimits.founders),
  traction: external_exports.array(ventureReportedFactSchema).max(ventureLimits.traction),
  terms: external_exports.object({ valuation: ventureValuationSchema, roundSize: ventureMoneySchema, minimumTicket: ventureMoneySchema, security: ventureFactSchema, fees: ventureFactSchema }).strict(),
  access: ventureAccessSchema,
  crypto: external_exports.object({ usage: ventureFactSchema, tokenomics: ventureFactSchema, liquidity: ventureFactSchema }).strict().nullable(),
  risks: external_exports.array(text(ventureLimits.riskText)).min(1).max(ventureLimits.risks),
  nextCatalyst: external_exports.object({ event: text(ventureLimits.catalystText), date: ventureDateSchema.nullable() }).strict(),
  scoring: external_exports.object({ components: ventureScoreComponentsSchema, confidence: external_exports.enum(["LOW", "MEDIUM", "HIGH"]) }).strict()
}).strict();
function claims(dossier) {
  return [
    dossier.product,
    dossier.customer,
    dossier.competition,
    dossier.edge,
    dossier.funding,
    dossier.dilution,
    ...dossier.founders,
    ...dossier.traction,
    dossier.terms.valuation,
    dossier.terms.roundSize,
    dossier.terms.minimumTicket,
    dossier.terms.security,
    dossier.terms.fees,
    ...dossier.crypto ? [dossier.crypto.usage, dossier.crypto.tokenomics, dossier.crypto.liquidity] : []
  ].filter((value) => value.state === "REPORTED");
}
var ventureDossierSchema = dossierBodySchema.superRefine((dossier, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path, message });
  if ((dossier.issuer.kind === "TOKEN" || dossier.issuer.sector === "CRYPTO_INFRA") && !dossier.crypto) issue(["crypto"], "Token and crypto infrastructure dossiers require explicit usage, tokenomics and liquidity states.");
  if (claims(dossier).some((value) => value.asOf > dossier.asOf) || dossier.access.status !== "UNKNOWN" && dossier.access.asOf > dossier.asOf) issue(["asOf"], "Reported claims must not postdate the dossier review.");
  if (dossier.terms.valuation.state === "UNKNOWN" && (dossier.scoring.components.valuation ?? 0) > 0) issue(["scoring", "components", "valuation"], "Unknown valuation cannot receive a positive entry-price score.");
  if (["UNKNOWN", "NO"].includes(dossier.access.status) && (dossier.scoring.components.accessibility ?? 0) > 0) issue(["scoring", "components", "accessibility"], "Unknown or unavailable access cannot receive a positive access score.");
});
function validateVentureSources(dossier, sources, at) {
  const parsed = ventureDossierSchema.safeParse(dossier);
  const admittedSources = external_exports.array(external_exports.object({ url: ventureUrlSchema }).passthrough()).max(ventureLimits.sources).safeParse(sources);
  if (!parsed.success || !admittedSources.success) throw new Error("Invalid venture sources or dates.");
  const value = parsed.data, urls = admittedSources.data.map((source) => new URL(source.url).href);
  if (new Set(urls).size !== urls.length || claims(value).some((claim) => claim.sourceIndices.some((index) => index >= sources.length)) || value.access.status !== "UNKNOWN" && value.access.sourceIndices.some((index) => index >= sources.length)) throw new Error("Invalid venture sources or dates.");
  if (at !== void 0) {
    const timestamp = typeof at === "string" && Number.isFinite(Date.parse(at)) && new Date(at).toISOString() === at;
    const date = ventureDateSchema.safeParse(at);
    if (!timestamp && !date.success || value.asOf > at.slice(0, 10)) throw new Error("Invalid venture sources or dates.");
  }
}

// app/research-model.ts
var researchLimits = { requestBytes: 24576, payloadBytes: 20480, publishPerSponsorDay: 20, stored: 3e3, revisions: 32, eventsPerRecord: 16, reportsPerSponsorDay: 10, reportsStored: 1e3, page: 20 };
var uuid = external_exports.string().uuid().refine((value) => value === value.toLowerCase());
var hash = external_exports.string().regex(/^[a-f0-9]{64}$/);
var humanId = external_exports.string().regex(/^human_[a-f0-9]{64}$/);
var clock = external_exports.string().datetime().refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
var text2 = (maximum, minimum = 1) => external_exports.string().trim().min(minimum).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine((value) => !tokenLike(value), "Agent credentials cannot be published.");
function tokenLike(value) {
  for (let n = 0; n < 3; n++) {
    if (/og_agent_/i.test(value)) return true;
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }
  return false;
}
var kind = external_exports.enum(["HYPOTHESIS", "OBSERVATION", "FAILURE", "CHALLENGE"]);
var policy = external_exports.literal("public-research-v1");
var researchSourceSchema = external_exports.object({ url: text2(2048).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}), classification: external_exports.enum(["PRIMARY", "SECONDARY", "AUTHOR_CLAIM", "ESTIMATE", "SPECULATION"]), note: text2(300, 0) }).strict();
var researchRelationSchema = external_exports.object({ type: external_exports.enum(["REVISION", "FORK", "CHALLENGE"]), id: uuid, digest: hash }).strict();
var contentFields = { kind, title: text2(120), statement: text2(4e3), assumptions: text2(1500), falsification: text2(2e3), sources: external_exports.array(researchSourceSchema).max(8), relation: researchRelationSchema.nullable() };
var researchPublishV1Schema = external_exports.object({ action: external_exports.literal("publish"), requestId: uuid, id: uuid, ...contentFields, policyAccepted: policy }).strict().superRefine((command, ctx) => {
  if (command.kind === "CHALLENGE" && command.relation?.type !== "CHALLENGE" && command.relation?.type !== "REVISION") ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["relation"], message: "A challenge must reference its exact target or revise an existing challenge." });
  if (command.relation?.type === "CHALLENGE" && command.kind !== "CHALLENGE") ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["kind"], message: "A challenge relation requires challenge research." });
  if (command.relation?.id === command.id) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["relation"], message: "A publication cannot reference itself." });
});
var ventureContentFields = { ...contentFields, domain: external_exports.literal("VENTURE"), venture: ventureDossierSchema };
var researchPublishV2Schema = external_exports.object({ version: external_exports.literal(2), action: external_exports.literal("publish"), requestId: uuid, id: uuid, ...ventureContentFields, policyAccepted: policy }).strict().superRefine((command, ctx) => {
  if (command.kind === "CHALLENGE" && command.relation?.type !== "CHALLENGE" && command.relation?.type !== "REVISION") ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["relation"], message: "A challenge must reference its exact target or revise an existing challenge." });
  if (command.relation?.type === "CHALLENGE" && command.kind !== "CHALLENGE") ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["kind"], message: "A challenge relation requires challenge research." });
  if (command.relation?.id === command.id) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["relation"], message: "A publication cannot reference itself." });
  if ([command.title, command.statement, command.assumptions, command.falsification, ...command.sources.flatMap((source) => [source.url, source.note])].some(ventureCredentialLike)) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Credentials cannot be published in venture research." });
  try {
    validateVentureSources(command.venture, command.sources);
  } catch {
    ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["venture"], message: "Invalid venture sources or dates." });
  }
});
var researchPublishSchema = external_exports.union([researchPublishV1Schema, researchPublishV2Schema]);
var common = { requestId: uuid, id: uuid, digest: hash, policyAccepted: policy };
var researchWithdrawSchema = external_exports.object({ action: external_exports.literal("withdraw"), ...common, reason: external_exports.enum(["AUTHOR_REQUEST", "SPONSOR_REQUEST", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE"]) }).strict();
var researchReportSchema = external_exports.object({ action: external_exports.literal("report"), ...common, reason: external_exports.enum(["SPAM", "ABUSE", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE", "MISLEADING", "OTHER"]), details: text2(1500) }).strict();
var researchModerateSchema = external_exports.object({ action: external_exports.literal("moderate"), ...common, state: external_exports.enum(["VISIBLE", "HIDDEN"]), reason: external_exports.enum(["SPAM", "ABUSE", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE", "MISLEADING", "POLICY", "RESTORED"]) }).strict().refine((command) => command.state === "VISIBLE" === (command.reason === "RESTORED"), "Restoration uses RESTORED; hiding uses a policy reason.");
var researchCommandSchema = external_exports.union([researchPublishSchema, researchWithdrawSchema, researchReportSchema, researchModerateSchema]);
var researchAuthorReferenceSchema = external_exports.discriminatedUnion("kind", [
  external_exports.object({ kind: external_exports.literal("HUMAN"), id: humanId, sponsorId: humanId }).strict(),
  external_exports.object({ kind: external_exports.literal("AGENT"), id: uuid, sponsorId: humanId }).strict()
]).refine((author) => author.kind !== "HUMAN" || author.id === author.sponsorId, "A human is their own sponsor.");
var researchAuthorSchema = external_exports.discriminatedUnion("kind", [
  external_exports.object({ kind: external_exports.literal("HUMAN"), id: humanId, sponsorId: humanId }).strict(),
  external_exports.object({ kind: external_exports.literal("AGENT"), id: uuid, sponsorId: humanId, name: external_exports.string().trim().min(1).max(48).regex(/^[^\u0000-\u001f\u007f]+$/) }).strict()
]);
var researchRecordV1Schema = external_exports.object({ version: external_exports.literal(1), id: uuid, rootId: uuid, revision: external_exports.number().int().min(1).max(researchLimits.revisions), requestId: uuid, createdAt: clock, author: researchAuthorSchema, content: external_exports.object(contentFields).strict(), policyAccepted: policy, verification: external_exports.literal("UNVERIFIED"), executionEnabled: external_exports.literal(false) }).strict().superRefine((record, ctx) => {
  if (record.author.kind === "HUMAN" && record.author.id !== record.author.sponsorId) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["author"], message: "A human is their own sponsor." });
  if (record.revision === 1 !== (record.rootId === record.id)) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["rootId"], message: "Only the first revision creates its own root." });
  if (record.revision > 1 !== (record.content.relation?.type === "REVISION")) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["revision"], message: "Revisions must reference a prior revision." });
  const command = researchPublishSchema.safeParse({ action: "publish", requestId: record.requestId, id: record.id, ...record.content, policyAccepted: record.policyAccepted });
  if (!command.success) command.error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ["content", ...issue.path] }));
});
var researchRecordV2Schema = external_exports.object({ version: external_exports.literal(2), id: uuid, rootId: uuid, revision: external_exports.number().int().min(1).max(researchLimits.revisions), requestId: uuid, createdAt: clock, author: researchAuthorSchema, content: external_exports.object(ventureContentFields).strict(), policyAccepted: policy, verification: external_exports.literal("UNVERIFIED"), executionEnabled: external_exports.literal(false) }).strict().superRefine((record, ctx) => {
  if (record.author.kind === "HUMAN" && record.author.id !== record.author.sponsorId) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["author"], message: "A human is their own sponsor." });
  if (record.revision === 1 !== (record.rootId === record.id)) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["rootId"], message: "Only the first revision creates its own root." });
  if (record.revision > 1 !== (record.content.relation?.type === "REVISION")) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["revision"], message: "Revisions must reference a prior revision." });
  const command = researchPublishV2Schema.safeParse({ version: 2, action: "publish", requestId: record.requestId, id: record.id, ...record.content, policyAccepted: record.policyAccepted });
  if (!command.success) command.error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ["content", ...issue.path] }));
  try {
    validateVentureSources(record.content.venture, record.content.sources, record.createdAt);
  } catch {
    ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["content", "venture"], message: "Invalid venture sources or dates." });
  }
});
var researchRecordSchema = external_exports.union([researchRecordV1Schema, researchRecordV2Schema]);
var state = external_exports.enum(["VISIBLE", "HIDDEN", "WITHDRAWN"]);
var safeReason = external_exports.enum(["AUTHOR_REQUEST", "SPONSOR_REQUEST", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE", "SPAM", "ABUSE", "MISLEADING", "POLICY", "RESTORED"]);
var researchPublicEventSchema = external_exports.object({ sequence: external_exports.number().int().min(1).max(researchLimits.eventsPerRecord), requestId: uuid, createdAt: clock, actor: researchAuthorReferenceSchema, state, reason: safeReason }).strict();
var researchPublicItemSchema = external_exports.object({ id: uuid, digest: hash, rootId: uuid, revision: external_exports.number().int().min(1).max(researchLimits.revisions), requestId: uuid, createdAt: clock, author: researchAuthorReferenceSchema, state, reason: safeReason.nullable(), record: researchRecordSchema.nullable(), moderation: external_exports.array(researchPublicEventSchema).max(researchLimits.eventsPerRecord) }).strict().superRefine((item, ctx) => {
  const bad = (message) => ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message });
  if (item.state === "VISIBLE" !== (item.record !== null)) bad("Non-visible research must be a content-free tombstone.");
  if (item.record && (item.id !== item.record.id || item.rootId !== item.record.rootId || item.revision !== item.record.revision || item.requestId !== item.record.requestId || item.createdAt !== item.record.createdAt || JSON.stringify(item.author) !== JSON.stringify(researchAuthorReference(item.record.author)))) bad("Public identity must match the retained record.");
  let current = "VISIBLE";
  let reason = null;
  item.moderation.forEach((event, index) => {
    if (event.sequence !== index + 1 || current === "WITHDRAWN" || Date.parse(event.createdAt) < Date.parse(index ? item.moderation[index - 1].createdAt : item.createdAt)) bad("Moderation history is inconsistent.");
    current = event.state;
    reason = event.reason;
  });
  if (current !== item.state || reason !== item.reason) bad("Public state must match its retained events.");
});
var researchListSchema = external_exports.object({ version: external_exports.literal(1), items: external_exports.array(researchPublicItemSchema).max(researchLimits.page), nextCursor: uuid.nullable(), executionEnabled: external_exports.literal(false) }).strict();
var researchVentureListSchema = external_exports.object({ version: external_exports.literal(1), domain: external_exports.literal("VENTURE"), items: external_exports.array(researchPublicItemSchema).max(researchLimits.page), nextCursor: uuid.nullable(), executionEnabled: external_exports.literal(false) }).strict().superRefine((page, ctx) => {
  const bad = (message) => ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message });
  if (new Set(page.items.map((item) => item.id)).size !== page.items.length || new Set(page.items.map((item) => `${item.rootId}:${item.revision}`)).size !== page.items.length) bad("Venture identities must be unique.");
  page.items.forEach((item, index) => {
    if (item.record && (item.record.version !== 2 || item.record.content.domain !== "VENTURE")) bad("Visible venture pages require exact venture records.");
    const previous = page.items[index - 1];
    if (previous && (item.createdAt > previous.createdAt || item.createdAt === previous.createdAt && item.id >= previous.id)) bad("Venture entries must be strictly newest first.");
  });
  if (page.nextCursor !== null && (page.items.length !== researchLimits.page || page.nextCursor !== page.items.at(-1)?.id)) bad("Venture cursor must identify the final full-page entry.");
});
var researchGetSchema = external_exports.object({ version: external_exports.literal(1), item: researchPublicItemSchema, executionEnabled: external_exports.literal(false) }).strict();
var researchHistorySchema = external_exports.object({ version: external_exports.literal(1), items: external_exports.array(researchPublicItemSchema).max(researchLimits.revisions), executionEnabled: external_exports.literal(false) }).strict();
var researchThreadSchema = external_exports.object({ version: external_exports.literal(1), target: researchPublicItemSchema, items: external_exports.array(researchPublicItemSchema).max(researchLimits.page), nextCursor: uuid.nullable(), executionEnabled: external_exports.literal(false) }).strict().superRefine((thread, ctx) => {
  const bad = (message) => ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message });
  if (thread.target.state !== "VISIBLE" && (thread.items.length !== 0 || thread.nextCursor !== null)) bad("Unavailable research has no public thread contents.");
  if (new Set(thread.items.map((item) => item.id)).size !== thread.items.length || new Set(thread.items.map((item) => `${item.rootId}:${item.revision}`)).size !== thread.items.length) bad("Thread identities must be unique.");
  thread.items.forEach((item, index) => {
    if (item.id === thread.target.id || Date.parse(item.createdAt) < Date.parse(thread.target.createdAt)) bad("Thread children must follow their exact target.");
    const relation = item.record?.content.relation;
    if (item.record && (!relation || relation.id !== thread.target.id || relation.digest !== thread.target.digest)) bad("Visible thread children must reference their exact target.");
    if (relation?.type === "REVISION" && (item.rootId !== thread.target.rootId || item.revision !== thread.target.revision + 1 || JSON.stringify(item.author) !== JSON.stringify(thread.target.author) || item.record?.content.kind !== thread.target.record?.content.kind || item.record?.version !== thread.target.record?.version || JSON.stringify(item.record?.version === 2 ? item.record.content.domain : null) !== JSON.stringify(thread.target.record?.version === 2 ? thread.target.record.content.domain : null))) bad("Direct revisions must preserve their exact parent lineage.");
    const previous = thread.items[index - 1];
    if (previous && (item.createdAt > previous.createdAt || item.createdAt === previous.createdAt && item.id >= previous.id)) bad("Thread entries must be strictly newest first.");
  });
  if (thread.nextCursor !== null && (thread.items.length !== researchLimits.page || thread.nextCursor !== thread.items.at(-1)?.id)) bad("Thread cursor must identify the final full-page entry.");
});
var researchPrivateReportSchema = external_exports.object({ requestId: uuid, id: uuid, digest: hash, reason: researchReportSchema.shape.reason, details: text2(1500), createdAt: clock, reporter: researchAuthorReferenceSchema }).strict();
var researchReportReceiptSchema = researchPrivateReportSchema.omit({ details: true, reporter: true });
var researchReportsSchema = external_exports.object({ version: external_exports.literal(1), reports: external_exports.array(researchPrivateReportSchema).max(researchLimits.page), nextCursor: hash.nullable(), executionEnabled: external_exports.literal(false) }).strict();
var researchWriteSchema = external_exports.object({ version: external_exports.literal(1), action: external_exports.enum(["publish", "withdraw", "report", "moderate"]), requestId: uuid, item: researchPublicItemSchema.nullable(), report: researchReportReceiptSchema.nullable(), executionEnabled: external_exports.literal(false) }).strict().refine((value) => value.action === "report" ? value.item === null && value.report?.requestId === value.requestId : value.item !== null && value.report === null, "Write receipts must match their action.");
var researchMeSchema = external_exports.object({ version: external_exports.literal(1), authorId: humanId, sponsorId: humanId, moderator: external_exports.boolean(), executionEnabled: external_exports.literal(false) }).strict().refine((value) => value.authorId === value.sponsorId);
async function researchDigest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function researchAuthorReference(author) {
  return researchAuthorReferenceSchema.parse(author.kind === "HUMAN" ? author : { kind: "AGENT", id: author.id, sponsorId: author.sponsorId });
}

// app/contribution-model.ts
var contributionLimits = { requestBytes: 16384, recordBytes: 12288, responseBytes: 524288, maximumDepth: 12, maximumNodes: 4096, page: 20, tasksStored: 500, claimsStored: 2e3, claimsPerTask: 32, taskEvents: 2, claimEvents: 8, registerPerMaintainerDay: 10, claimsPerSponsorDay: 10, activePerSponsor: 2, leaseHours: 72 };
var contributionPolicy = "public-contributions-v1";
var contributionCloseReasons = ["MAINTAINER_CLOSED", "SUPERSEDED", "OUT_OF_SCOPE", "POLICY"];
var contributionHideReasons = ["POLICY", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE", "ABUSE"];
var contributionReleaseReasons = ["AUTHOR_RELEASE", "SPONSOR_RELEASE"];
var contributionReviewReasons = ["ACCEPTANCE_MET", "NEEDS_CHANGES", "FAILED_ACCEPTANCE", "INCOMPLETE_EVIDENCE", "STALE_EVIDENCE", "OUT_OF_SCOPE", "INVALID_HANDOFF", "CONFLICT_OF_INTEREST", "POLICY"];
var contributionDecisions = ["ACCEPTED", "CHANGES_REQUESTED", "REJECTED"];
var contributionAuthorSchema = researchAuthorReferenceSchema;
var contributionAuthorReferenceSchema = researchAuthorReferenceSchema;
var uuid2 = external_exports.string().uuid().refine((value) => value === value.toLowerCase());
var hash2 = external_exports.string().regex(/^[a-f0-9]{64}$/);
var clock2 = external_exports.string().datetime().refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
var humanId2 = external_exports.string().regex(/^human_[a-f0-9]{64}$/);
var human = external_exports.object({ kind: external_exports.literal("HUMAN"), id: humanId2, sponsorId: humanId2 }).strict().refine((value) => value.id === value.sponsorId);
var text3 = (maximum) => external_exports.string().trim().min(1).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine((value) => !ventureCredentialLike(value));
var criterion = external_exports.array(text3(300)).min(1).max(8).refine((value) => new Set(value).size === value.length);
var policy2 = external_exports.literal(contributionPolicy);
var taskState = external_exports.enum(["OPEN", "CLOSED", "HIDDEN"]);
var taskSequence = external_exports.number().int().min(0).max(contributionLimits.taskEvents);
var claimSequence = external_exports.number().int().min(0).max(contributionLimits.claimEvents);
var contributionReferenceSchema = external_exports.object({ id: uuid2, digest: hash2 }).strict();
var taskFields = { title: text3(120), summary: text3(2e3), kind: external_exports.enum(["CODE", "DOCS", "TESTS"]), acceptance: criterion, rejection: criterion };
var common2 = { requestId: uuid2, policyAccepted: policy2 };
var contributionRegisterSchema = external_exports.object({ action: external_exports.literal("register"), ...common2, id: uuid2, ...taskFields }).strict();
var contributionClaimV1Schema = external_exports.object({ action: external_exports.literal("claim"), ...common2, id: uuid2, task: contributionReferenceSchema, expectedTaskSequence: taskSequence }).strict().refine((value) => value.id !== value.task.id);
var contributionRevisionReferenceSchema = external_exports.object({ claim: contributionReferenceSchema, review: external_exports.object({ sequence: external_exports.number().int().min(1).max(contributionLimits.claimEvents), digest: hash2 }).strict() }).strict();
var contributionClaimV2Schema = external_exports.object({ version: external_exports.literal(2), action: external_exports.literal("claim"), ...common2, id: uuid2, task: contributionReferenceSchema, expectedTaskSequence: taskSequence, revisionOf: contributionRevisionReferenceSchema }).strict().refine((value) => value.id !== value.task.id && value.id !== value.revisionOf.claim.id && value.task.id !== value.revisionOf.claim.id);
var contributionClaimSchema = external_exports.union([contributionClaimV1Schema, contributionClaimV2Schema]);
var contributionCloseSchema = external_exports.object({ action: external_exports.literal("close"), ...common2, task: contributionReferenceSchema, expectedSequence: taskSequence, reason: external_exports.enum(contributionCloseReasons) }).strict();
var contributionHideSchema = external_exports.object({ action: external_exports.literal("hide"), ...common2, task: contributionReferenceSchema, expectedSequence: taskSequence, reason: external_exports.enum(contributionHideReasons) }).strict();
var claimOperation = { ...common2, task: contributionReferenceSchema, claim: contributionReferenceSchema, expectedSequence: claimSequence };
var contributionReleaseSchema = external_exports.object({ action: external_exports.literal("release"), ...claimOperation, reason: external_exports.enum(contributionReleaseReasons) }).strict();
var contributionSubmitSchema = external_exports.object({ action: external_exports.literal("submit"), ...claimOperation, handoffDigest: hash2 }).strict();
var contributionReviewSchema = external_exports.object({ action: external_exports.literal("review"), ...claimOperation, decision: external_exports.enum(contributionDecisions), reason: external_exports.enum(contributionReviewReasons) }).strict().refine((value) => value.decision === "ACCEPTED" ? value.reason === "ACCEPTANCE_MET" : value.reason !== "ACCEPTANCE_MET" && (value.decision !== "REJECTED" || value.reason !== "NEEDS_CHANGES"));
var contributionCommandSchema = external_exports.union([contributionRegisterSchema, contributionClaimSchema, contributionCloseSchema, contributionHideSchema, contributionReleaseSchema, contributionSubmitSchema, contributionReviewSchema]);
var contributionTaskRecordSchema = external_exports.object({ version: external_exports.literal(1), id: uuid2, requestId: uuid2, createdAt: clock2, author: human, content: external_exports.object(taskFields).strict(), policyAccepted: policy2, executionEnabled: external_exports.literal(false) }).strict();
var contributionClaimRecordV1Schema = external_exports.object({ version: external_exports.literal(1), id: uuid2, requestId: uuid2, createdAt: clock2, expiresAt: clock2, author: contributionAuthorSchema, task: contributionReferenceSchema, policyAccepted: policy2, executionEnabled: external_exports.literal(false) }).strict().refine((value) => value.id !== value.task.id && Date.parse(value.expiresAt) - Date.parse(value.createdAt) === contributionLimits.leaseHours * 36e5);
var contributionClaimRecordV2Schema = external_exports.object({ version: external_exports.literal(2), id: uuid2, requestId: uuid2, createdAt: clock2, expiresAt: clock2, author: contributionAuthorSchema, task: contributionReferenceSchema, policyAccepted: policy2, executionEnabled: external_exports.literal(false), revisionOf: contributionRevisionReferenceSchema }).strict().refine((value) => value.id !== value.task.id && value.id !== value.revisionOf.claim.id && value.task.id !== value.revisionOf.claim.id && Date.parse(value.expiresAt) - Date.parse(value.createdAt) === contributionLimits.leaseHours * 36e5);
var contributionClaimRecordSchema = external_exports.union([contributionClaimRecordV1Schema, contributionClaimRecordV2Schema]);
var eventFields = { version: external_exports.literal(1), requestId: uuid2, createdAt: clock2, actor: contributionAuthorReferenceSchema, task: contributionReferenceSchema, expectedSequence: taskSequence, sequence: external_exports.number().int().min(1).max(contributionLimits.taskEvents), policyAccepted: policy2, executionEnabled: external_exports.literal(false) };
var contributionTaskEventRecordSchema = external_exports.object({ ...eventFields, actor: human, action: external_exports.enum(["close", "hide"]), state: external_exports.enum(["CLOSED", "HIDDEN"]), reason: external_exports.enum([...contributionCloseReasons, ...contributionHideReasons]) }).strict().superRefine((value, ctx) => {
  if (value.sequence !== value.expectedSequence + 1 || value.state !== (value.action === "close" ? "CLOSED" : "HIDDEN")) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Task event sequence and action must agree." });
  if (!contributionCommandSchema.safeParse(contributionEventCommand(value)).success) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Task event command must be valid." });
});
var eventState = external_exports.enum(["SUBMITTED", "RELEASED", "ACCEPTED", "CHANGES_REQUESTED", "REJECTED"]);
var contributionClaimEventRecordSchema = external_exports.object({ ...eventFields, expectedSequence: claimSequence, sequence: external_exports.number().int().min(1).max(contributionLimits.claimEvents), claim: contributionReferenceSchema, action: external_exports.enum(["release", "submit", "review"]), state: eventState, reason: external_exports.enum([...contributionReleaseReasons, ...contributionReviewReasons]).nullable(), decision: external_exports.enum(contributionDecisions).nullable(), handoffDigest: hash2.nullable() }).strict().superRefine((value, ctx) => {
  if (value.sequence !== value.expectedSequence + 1 || value.claim.id === value.task.id) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Claim event identities and sequence must agree." });
  if (value.action === "submit" ? value.state !== "SUBMITTED" || value.reason !== null || value.decision !== null || value.handoffDigest === null : value.action === "release" ? value.state !== "RELEASED" || value.decision !== null || value.handoffDigest !== null || value.reason === null : value.actor.kind !== "HUMAN" || value.state !== value.decision || value.handoffDigest !== null || value.reason === null) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Claim event fields must match their action." });
  if (!contributionCommandSchema.safeParse(contributionEventCommand(value)).success) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Claim event command must be valid." });
});
function contributionEventCommand(value) {
  const common4 = { action: value.action, requestId: value.requestId, task: value.task, expectedSequence: value.expectedSequence, policyAccepted: value.policyAccepted };
  return value.action === "close" || value.action === "hide" ? { ...common4, reason: value.reason } : value.action === "submit" ? { ...common4, claim: value.claim, handoffDigest: value.handoffDigest } : value.action === "release" ? { ...common4, claim: value.claim, reason: value.reason } : { ...common4, claim: value.claim, decision: value.decision, reason: value.reason };
}
var contributionTaskEventSchema = external_exports.object({ ...eventFields, actor: human, action: external_exports.enum(["close", "hide"]), state: external_exports.enum(["CLOSED", "HIDDEN"]), reason: external_exports.enum([...contributionCloseReasons, ...contributionHideReasons]), digest: hash2 }).strict().refine((value) => contributionTaskEventRecordSchema.safeParse(withoutDigest(value)).success);
var contributionClaimEventSchema = external_exports.object({ ...eventFields, expectedSequence: claimSequence, sequence: external_exports.number().int().min(1).max(contributionLimits.claimEvents), claim: contributionReferenceSchema, action: external_exports.enum(["release", "submit", "review"]), state: eventState, reason: external_exports.enum([...contributionReleaseReasons, ...contributionReviewReasons]).nullable(), decision: external_exports.enum(contributionDecisions).nullable(), handoffDigest: hash2.nullable(), digest: hash2 }).strict().refine((value) => contributionClaimEventRecordSchema.safeParse(withoutDigest(value)).success);
function withoutDigest(value) {
  const { digest: digest2, ...body } = value;
  void digest2;
  return body;
}
var identityFields = { id: uuid2, digest: hash2, requestId: uuid2, createdAt: clock2 };
var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
var requestKey = (actor, requestId) => actor.kind + ":" + actor.id + ":" + requestId;
var contributionTaskItemSchema = external_exports.object({ ...identityFields, author: human, state: taskState, sequence: taskSequence, reason: external_exports.enum([...contributionCloseReasons, ...contributionHideReasons]).nullable(), record: contributionTaskRecordSchema.nullable(), events: external_exports.array(contributionTaskEventSchema).max(contributionLimits.taskEvents) }).strict().superRefine((item, ctx) => {
  const bad = () => ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Task identity and lifecycle must agree." });
  if (item.state === "HIDDEN" !== (item.record === null) || item.sequence !== item.events.length) bad();
  if (item.record && (item.id !== item.record.id || item.requestId !== item.record.requestId || item.createdAt !== item.record.createdAt || !same(item.author, item.record.author))) bad();
  let current = "OPEN", reason = null, at = item.createdAt;
  const requests = /* @__PURE__ */ new Set([requestKey(item.author, item.requestId)]);
  for (let n = 0; n < item.events.length; n++) {
    const event = item.events[n], key = requestKey(event.actor, event.requestId);
    if (event.sequence !== n + 1 || event.createdAt < at || current === "HIDDEN" || event.action === "close" && current !== "OPEN" || !same(event.task, { id: item.id, digest: item.digest }) || requests.has(key)) bad();
    current = event.state;
    reason = event.reason;
    at = event.createdAt;
    requests.add(key);
  }
  if (current !== item.state || reason !== item.reason) bad();
});
var contributionClaimStatusSchema = external_exports.enum(["ACTIVE", "SUBMITTED", "RELEASED", "EXPIRED", "ACCEPTED", "CHANGES_REQUESTED", "REJECTED"]);
var contributionClaimItemSchema = external_exports.object({ ...identityFields, expiresAt: clock2, checkedAt: clock2, author: contributionAuthorSchema, task: contributionReferenceSchema, taskState, sequence: claimSequence, status: contributionClaimStatusSchema, handoffDigest: hash2.nullable(), reason: external_exports.enum([...contributionReleaseReasons, ...contributionReviewReasons]).nullable(), record: contributionClaimRecordSchema.nullable(), events: external_exports.array(contributionClaimEventSchema).max(contributionLimits.claimEvents) }).strict().superRefine((item, ctx) => {
  const bad = () => ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Claim identity and lifecycle must agree." });
  if (item.id === item.task.id || Date.parse(item.expiresAt) - Date.parse(item.createdAt) !== contributionLimits.leaseHours * 36e5 || item.checkedAt < item.createdAt) bad();
  if ((item.status === "ACTIVE" || item.status === "SUBMITTED") && item.checkedAt >= item.expiresAt || item.status === "EXPIRED" && item.checkedAt < item.expiresAt) bad();
  if (item.taskState === "HIDDEN") {
    if (item.record !== null || item.handoffDigest !== null || item.reason !== null || item.events.length !== 0) bad();
    return;
  }
  if (item.record === null || item.sequence !== item.events.length) bad();
  if (item.record && (item.id !== item.record.id || item.requestId !== item.record.requestId || item.createdAt !== item.record.createdAt || item.expiresAt !== item.record.expiresAt || !same(item.author, item.record.author) || !same(item.task, item.record.task))) bad();
  let current = "ACTIVE", handoff = null, reason = null, at = item.createdAt;
  const requests = /* @__PURE__ */ new Set([requestKey(item.author, item.requestId)]);
  for (let n = 0; n < item.events.length; n++) {
    const event = item.events[n], key = requestKey(event.actor, event.requestId);
    if (event.sequence !== n + 1 || event.createdAt < at || event.createdAt >= item.expiresAt || !same(event.task, item.task) || !same(event.claim, { id: item.id, digest: item.digest }) || requests.has(key) || current !== "ACTIVE" && current !== "SUBMITTED") bad();
    if (event.action === "submit") {
      if (current !== "ACTIVE" || !same(event.actor, item.author)) bad();
      handoff = event.handoffDigest;
    }
    if (event.action === "release") {
      if (event.reason === "AUTHOR_RELEASE" ? !same(event.actor, item.author) : item.author.kind !== "AGENT" || event.actor.kind !== "HUMAN" || event.actor.id !== item.author.sponsorId) bad();
    }
    if (event.action === "review" && (current !== "SUBMITTED" || handoff === null || event.actor.kind !== "HUMAN")) bad();
    current = event.state;
    reason = event.reason;
    at = event.createdAt;
    requests.add(key);
  }
  if (at > item.checkedAt) bad();
  if ((current === "ACTIVE" || current === "SUBMITTED") && item.checkedAt >= item.expiresAt) current = "EXPIRED";
  if (item.status !== current || item.handoffDigest !== handoff || item.reason !== reason) bad();
});
var envelope = { version: external_exports.literal(1), executionEnabled: external_exports.literal(false) };
function pageRules(items, nextCursor) {
  return new Set(items.map((item) => item.id)).size === items.length && items.every((item, n) => !n || item.createdAt < items[n - 1].createdAt || item.createdAt === items[n - 1].createdAt && item.id < items[n - 1].id) && (nextCursor === null || items.length === contributionLimits.page && nextCursor === items.at(-1)?.id);
}
var contributionListSchema = external_exports.object({ ...envelope, items: external_exports.array(contributionTaskItemSchema).max(contributionLimits.page), nextCursor: uuid2.nullable() }).strict().refine((value) => pageRules(value.items, value.nextCursor));
var contributionGetSchema = external_exports.object({ ...envelope, item: contributionTaskItemSchema }).strict();
var contributionClaimsSchema = external_exports.object({ ...envelope, task: contributionTaskItemSchema, items: external_exports.array(contributionClaimItemSchema).max(contributionLimits.page), nextCursor: uuid2.nullable() }).strict().refine((value) => pageRules(value.items, value.nextCursor) && value.items.every((item) => same(item.task, { id: value.task.id, digest: value.task.digest }) && item.taskState === value.task.state));
var contributionClaimGetSchema = external_exports.object({ ...envelope, task: contributionTaskItemSchema, item: contributionClaimItemSchema }).strict().refine((value) => same(value.item.task, { id: value.task.id, digest: value.task.digest }) && value.item.taskState === value.task.state);
var contributionMeSchema = external_exports.object({ ...envelope, authorId: humanId2, sponsorId: humanId2, maintainer: external_exports.boolean() }).strict().refine((value) => value.authorId === value.sponsorId);
var action = external_exports.enum(["register", "claim", "close", "hide", "release", "submit", "review"]);
var contributionAcknowledgementSchema = external_exports.object({ action, requestId: uuid2, actor: contributionAuthorReferenceSchema, task: contributionReferenceSchema, claim: contributionReferenceSchema.nullable(), sequence: claimSequence, createdAt: clock2, commandDigest: hash2, digest: hash2 }).strict().refine((value) => value.action === "register" || value.action === "claim" ? value.sequence === 0 : value.sequence > 0).refine((value) => ["register", "close", "hide"].includes(value.action) ? value.claim === null : value.claim !== null).refine((value) => !["register", "close", "hide", "review"].includes(value.action) || value.actor.kind === "HUMAN");
var contributionWriteSchema = external_exports.object({ ...envelope, action, requestId: uuid2, task: contributionTaskItemSchema, claim: contributionClaimItemSchema.nullable(), acknowledgement: contributionAcknowledgementSchema }).strict().superRefine((value, ctx) => {
  const ack = value.acknowledgement, bad = () => ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Contribution acknowledgement must match its receipt." });
  if (value.action !== ack.action || value.requestId !== ack.requestId || !same(ack.task, { id: value.task.id, digest: value.task.digest }) || (["register", "close", "hide"].includes(value.action) ? value.claim !== null : value.claim === null)) bad();
  if (value.claim && (!same(value.claim.task, ack.task) || value.claim.taskState !== value.task.state || !same(ack.claim, { id: value.claim.id, digest: value.claim.digest }))) bad();
  if (ack.sequence > (value.claim ? value.claim.sequence : value.task.sequence)) bad();
});
var ContributionError = class extends Error {
  constructor(message, status = 409, retryAfterSeconds) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
  status;
  retryAfterSeconds;
};
var bytes = (value) => new TextEncoder().encode(value).byteLength;
function plain(raw) {
  let nodes = 0;
  const seen = /* @__PURE__ */ new Set();
  function walk(value, depth) {
    if (++nodes > contributionLimits.maximumNodes || depth > contributionLimits.maximumDepth) throw new ContributionError("Contribution structure exceeds its bound.", 400);
    if (typeof value === "string") {
      if (ventureCredentialLike(value)) throw new ContributionError("Credentials cannot be published.", 400);
      return;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return;
    if (!value || typeof value !== "object" || seen.has(value)) throw new ContributionError("Contribution material must be plain JSON data.", 400);
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.getOwnPropertySymbols(value).length || (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) || array && Object.keys(descriptors).length !== value.length + 1) throw new ContributionError("Contribution material must be plain JSON data.", 400);
    seen.add(value);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (ventureCredentialLike(key) || !("value" in descriptor) || !descriptor.enumerable || array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) throw new ContributionError("Contribution material must be plain JSON data.", 400);
      walk(descriptor.value, depth + 1);
    }
    seen.delete(value);
  }
  walk(raw, 0);
}
function bounded(raw, schema, maximum) {
  plain(raw);
  if (bytes(JSON.stringify(raw)) > maximum) throw new ContributionError("Contribution material exceeds its byte bound.", 413);
  const record = schema.parse(raw), payload = JSON.stringify(record);
  if (bytes(payload) > maximum) throw new ContributionError("Contribution material exceeds its byte bound.", 413);
  return { record, payload };
}
function boundedContributionTaskRecord(raw) {
  return bounded(raw, contributionTaskRecordSchema, contributionLimits.recordBytes);
}
var contributionRecordSchema = external_exports.union([contributionTaskRecordSchema, contributionClaimRecordSchema, contributionTaskEventRecordSchema, contributionClaimEventRecordSchema]);
function boundedContributionRecord(raw) {
  return bounded(raw, contributionRecordSchema, contributionLimits.recordBytes);
}
async function checkEvent(value) {
  const body = withoutDigest(value), checked = boundedContributionRecord(body);
  if (await researchDigest(checked.payload) !== value.digest) throw new ContributionError("Contribution event digest does not match.", 400);
}
async function validateContributionTaskItem(raw) {
  plain(raw);
  const item = contributionTaskItemSchema.parse(raw);
  if (item.record && await researchDigest(boundedContributionTaskRecord(item.record).payload) !== item.digest) throw new ContributionError("Contribution task digest does not match.", 400);
  for (const event of item.events) await checkEvent(event);
  return item;
}

// app/task-discussion-model.ts
var taskDiscussionPolicy = "public-task-discussion-v1";
var taskDiscussionLimits = { requestBytes: 8192, recordBytes: 6144, eventBytes: 4096, reportBytes: 2048, responseBytes: 262144, maximumDepth: 12, maximumNodes: 4096, page: 16, bodyCharacters: 4e3, detailsCharacters: 1e3, messagesStored: 2e3, messagesPerTask: 64, messagesPerSponsorDay: 20, eventsPerMessage: 2, reportsStored: 2e3, reportsPerSponsorDay: 10 };
var taskDiscussionKinds = ["QUESTION", "PROPOSAL", "COUNTEREXAMPLE", "PEER_REVIEW"];
var taskDiscussionWithdrawReasons = ["AUTHOR_REQUEST", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE"];
var taskDiscussionHideReasons = ["POLICY", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE", "ABUSE"];
var taskDiscussionReportCategories = ["SPAM", "ABUSE", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE", "PRIVATE_MATERIAL", "MISLEADING", "OTHER"];
var TaskDiscussionError = class extends Error {
  constructor(message, status = 409, retryAfterSeconds) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
  status;
  retryAfterSeconds;
};
var uuid3 = external_exports.string().length(36).regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
var digest = external_exports.string().length(64).regex(/^[a-f0-9]{64}$/);
var humanId3 = external_exports.string().length(70).regex(/^human_[a-f0-9]{64}$/);
var clock3 = external_exports.string().datetime().refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
var same2 = (a, b) => JSON.stringify(a) === JSON.stringify(b);
var bytes2 = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
function taskDiscussionCredentialLike(value) {
  for (let n = 0; n < 32; n++) {
    if (ventureCredentialLike(value) || /(?:sk-(?:(?:proj|svcacct)-|ant-api\d+-)[a-z0-9_-]{20,}|sk-[a-z0-9]{20,}|xox[baprs]-[a-z0-9-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|authorization\s*:\s*bearer\s+[a-z0-9._~-]{20,})/i.test(value)) return true;
    const decoded = value.replace(/(?:%[a-f0-9]{2})+/gi, (run) => {
      try {
        return decodeURIComponent(run);
      } catch {
        return run.replace(/%([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      }
    });
    if (decoded === value) return false;
    value = decoded;
  }
  return true;
}
var text4 = (maximum) => external_exports.string().min(1).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine((value) => value === value.trim() && !taskDiscussionCredentialLike(value));
var human2 = external_exports.object({ kind: external_exports.literal("HUMAN"), id: humanId3, sponsorId: humanId3 }).strict().refine((author) => author.id === author.sponsorId);
var agent = external_exports.object({ kind: external_exports.literal("AGENT"), id: uuid3, sponsorId: humanId3 }).strict();
var taskDiscussionAuthorSchema = external_exports.union([human2, agent]);
var taskDiscussionReferenceSchema = external_exports.object({ id: uuid3, digest }).strict();
var policy3 = external_exports.literal(taskDiscussionPolicy);
var taskSequence2 = external_exports.number().int().min(0).max(2);
var expectedSequence = external_exports.number().int().min(0).max(1);
var eventSequence = external_exports.number().int().min(1).max(2);
var common3 = { requestId: uuid3, task: taskDiscussionReferenceSchema, policyAccepted: policy3 };
var taskDiscussionPublishSchema = external_exports.object({ action: external_exports.literal("publish"), id: uuid3, ...common3, expectedTaskSequence: taskSequence2, claim: taskDiscussionReferenceSchema.nullable(), replyTo: taskDiscussionReferenceSchema.nullable(), kind: external_exports.enum(taskDiscussionKinds), body: text4(taskDiscussionLimits.bodyCharacters) }).strict().refine((value) => value.id !== value.task.id && value.id !== value.claim?.id && value.id !== value.replyTo?.id && value.claim?.id !== value.task.id && value.replyTo?.id !== value.task.id, "Message and related identities must be distinct.");
var operation = { ...common3, message: taskDiscussionReferenceSchema, expectedSequence };
var taskDiscussionWithdrawSchema = external_exports.object({ action: external_exports.literal("withdraw"), ...operation, reason: external_exports.enum(taskDiscussionWithdrawReasons) }).strict().refine((value) => value.task.id !== value.message.id);
var taskDiscussionHideSchema = external_exports.object({ action: external_exports.literal("hide"), ...operation, reason: external_exports.enum(taskDiscussionHideReasons) }).strict().refine((value) => value.task.id !== value.message.id && value.expectedSequence === 0, "Hide uses the first terminal event slot only.");
var taskDiscussionReportSchema = external_exports.object({ action: external_exports.literal("report"), ...common3, message: taskDiscussionReferenceSchema, category: external_exports.enum(taskDiscussionReportCategories), details: text4(taskDiscussionLimits.detailsCharacters) }).strict().refine((value) => value.task.id !== value.message.id);
var taskDiscussionCommandSchema = external_exports.union([taskDiscussionPublishSchema, taskDiscussionWithdrawSchema, taskDiscussionHideSchema, taskDiscussionReportSchema]);
var taskDiscussionRecordSchema = external_exports.object({ version: external_exports.literal(1), id: uuid3, requestId: uuid3, createdAt: clock3, author: taskDiscussionAuthorSchema, task: taskDiscussionReferenceSchema, claim: taskDiscussionReferenceSchema.nullable(), replyTo: taskDiscussionReferenceSchema.nullable(), kind: external_exports.enum(taskDiscussionKinds), body: text4(taskDiscussionLimits.bodyCharacters), policyAccepted: policy3, executionEnabled: external_exports.literal(false) }).strict().refine((record) => record.id !== record.task.id && record.id !== record.claim?.id && record.id !== record.replyTo?.id && record.claim?.id !== record.task.id && record.replyTo?.id !== record.task.id);
var eventFields2 = { version: external_exports.literal(1), task: taskDiscussionReferenceSchema, message: taskDiscussionReferenceSchema, actor: taskDiscussionAuthorSchema, requestId: uuid3, createdAt: clock3, action: external_exports.enum(["withdraw", "hide"]), expectedSequence, sequence: eventSequence, state: external_exports.enum(["HIDDEN", "WITHDRAWN"]), reason: external_exports.enum([...taskDiscussionWithdrawReasons, ...taskDiscussionHideReasons]), policyAccepted: policy3, executionEnabled: external_exports.literal(false) };
var eventBody = external_exports.object(eventFields2).strict();
function eventRules(value) {
  return value.task.id !== value.message.id && value.sequence === value.expectedSequence + 1 && (value.action === "hide" ? value.expectedSequence === 0 && value.sequence === 1 && value.state === "HIDDEN" && value.actor.kind === "HUMAN" && taskDiscussionHideReasons.includes(value.reason) : value.state === "WITHDRAWN" && taskDiscussionWithdrawReasons.includes(value.reason));
}
var taskDiscussionEventRecordSchema = eventBody.refine(eventRules);
var taskDiscussionEventSchema = eventBody.extend({ digest }).refine(eventRules);
var taskDiscussionPrivateReportSchema = external_exports.object({ requestId: uuid3, task: taskDiscussionReferenceSchema, message: taskDiscussionReferenceSchema, category: external_exports.enum(taskDiscussionReportCategories), details: text4(taskDiscussionLimits.detailsCharacters), createdAt: clock3, reporter: taskDiscussionAuthorSchema }).strict().refine((report) => report.task.id !== report.message.id);
var taskDiscussionReportReceiptSchema = external_exports.object({ requestId: uuid3, task: taskDiscussionReferenceSchema, message: taskDiscussionReferenceSchema, category: external_exports.enum(taskDiscussionReportCategories), createdAt: clock3 }).strict().refine((report) => report.task.id !== report.message.id);
var itemShape = external_exports.object({ id: uuid3, digest, requestId: uuid3, createdAt: clock3, author: taskDiscussionAuthorSchema, task: taskDiscussionReferenceSchema, taskState: external_exports.enum(["OPEN", "CLOSED", "HIDDEN"]), sequence: external_exports.number().int().min(0).max(2), state: external_exports.enum(["VISIBLE", "HIDDEN", "WITHDRAWN"]), reason: external_exports.enum([...taskDiscussionWithdrawReasons, ...taskDiscussionHideReasons]).nullable(), record: taskDiscussionRecordSchema.nullable(), events: external_exports.array(taskDiscussionEventSchema).max(2) }).strict();
var taskDiscussionItemSchema = itemShape.superRefine((item, ctx) => {
  const bad = () => ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Discussion identity, state and retained history must agree." });
  if (item.id === item.task.id || item.sequence !== item.events.length || item.state === "VISIBLE" !== (item.record !== null)) bad();
  if (item.record) {
    const record = item.record;
    if (record.id !== item.id || record.requestId !== item.requestId || record.createdAt !== item.createdAt || !same2(record.author, item.author) || !same2(record.task, item.task)) bad();
  }
  let own = "VISIBLE", at = item.createdAt;
  const requests = /* @__PURE__ */ new Set([item.author.kind + ":" + item.author.id + ":" + item.requestId]);
  for (let n = 0; n < item.events.length; n++) {
    const event = item.events[n], key = event.actor.kind + ":" + event.actor.id + ":" + event.requestId;
    if (event.sequence !== n + 1 || event.expectedSequence !== n || event.createdAt < at || !same2(event.task, item.task) || !same2(event.message, { id: item.id, digest: item.digest }) || requests.has(key) || own === "WITHDRAWN" || event.action === "hide" && own !== "VISIBLE" || event.action === "withdraw" && !same2(event.actor, item.author)) bad();
    requests.add(key);
    own = event.state;
    at = event.createdAt;
  }
  const state2 = own === "WITHDRAWN" ? "WITHDRAWN" : own === "HIDDEN" || item.taskState === "HIDDEN" ? "HIDDEN" : "VISIBLE";
  if (item.state !== state2 || item.reason !== (item.events.at(-1)?.reason ?? null)) bad();
});
var envelope2 = { version: external_exports.literal(1), executionEnabled: external_exports.literal(false) };
var itemMatchesTask = (item, task) => same2(item.task, { id: task.id, digest: task.digest }) && item.taskState === task.state && item.createdAt >= task.createdAt;
var taskDiscussionListSchema = external_exports.object({ ...envelope2, task: contributionTaskItemSchema, items: external_exports.array(taskDiscussionItemSchema).max(taskDiscussionLimits.page), nextCursor: uuid3.nullable() }).strict().superRefine((value, ctx) => {
  if (new Set(value.items.map((item) => item.id)).size !== value.items.length || value.items.some((item, n) => !itemMatchesTask(item, value.task) || n > 0 && (item.createdAt > value.items[n - 1].createdAt || item.createdAt === value.items[n - 1].createdAt && item.id >= value.items[n - 1].id)) || value.nextCursor !== null && (value.items.length !== taskDiscussionLimits.page || value.nextCursor !== value.items.at(-1)?.id)) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Discussion page scope, identity, order and cursor must agree." });
});
var taskDiscussionGetSchema = external_exports.object({ ...envelope2, task: contributionTaskItemSchema, item: taskDiscussionItemSchema }).strict().refine((value) => itemMatchesTask(value.item, value.task));
var taskDiscussionAcknowledgementSchema = external_exports.object({ actor: taskDiscussionAuthorSchema, commandDigest: digest, digest, createdAt: clock3, sequence: external_exports.number().int().min(0).max(2) }).strict();
var taskDiscussionWriteSchema = external_exports.object({ ...envelope2, action: external_exports.enum(["publish", "withdraw", "hide", "report"]), requestId: uuid3, acknowledgement: taskDiscussionAcknowledgementSchema, task: contributionTaskItemSchema, message: taskDiscussionItemSchema.nullable(), report: taskDiscussionReportReceiptSchema.nullable() }).strict().superRefine((value, ctx) => {
  const bad = () => ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Discussion acknowledgement must match its current projection." }), ack = value.acknowledgement;
  if (ack.createdAt < value.task.createdAt) bad();
  if (value.action === "report") {
    if (value.message !== null || !value.report || ack.sequence !== 0 || value.report.requestId !== value.requestId || value.report.createdAt !== ack.createdAt || !same2(value.report.task, { id: value.task.id, digest: value.task.digest })) bad();
  } else {
    if (!value.message || value.report !== null) bad();
    if (value.message) {
      const item = value.message;
      if (!itemMatchesTask(item, value.task) || ack.createdAt < item.createdAt) bad();
      if (value.action === "publish") {
        if (ack.sequence !== 0 || ack.createdAt !== item.createdAt || value.requestId !== item.requestId || ack.digest !== item.digest || !same2(ack.actor, item.author)) bad();
      } else {
        const event = item.events.find((event2) => event2.requestId === value.requestId && same2(event2.actor, ack.actor));
        if (!event || event.action !== value.action || event.createdAt !== ack.createdAt || event.digest !== ack.digest || event.sequence !== ack.sequence || ack.sequence > item.sequence) bad();
      }
    }
  }
});
var reportKey = (report) => report.reporter.kind + ":" + report.reporter.id;
var taskDiscussionReportsSchema = external_exports.object({ ...envelope2, reports: external_exports.array(taskDiscussionPrivateReportSchema).max(taskDiscussionLimits.page), nextCursor: digest.nullable() }).strict().superRefine((value, ctx) => {
  if (new Set(value.reports.map((report) => reportKey(report) + ":" + report.requestId)).size !== value.reports.length || value.reports.some((report, n) => n > 0 && (report.createdAt > value.reports[n - 1].createdAt || report.createdAt === value.reports[n - 1].createdAt && (reportKey(report) > reportKey(value.reports[n - 1]) || reportKey(report) === reportKey(value.reports[n - 1]) && report.requestId >= value.reports[n - 1].requestId))) || value.nextCursor !== null && value.reports.length !== taskDiscussionLimits.page) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Private report identities, order and cursor must agree." });
});
var taskDiscussionMeSchema = external_exports.object({ ...envelope2, authorId: humanId3, sponsorId: humanId3, maintainer: external_exports.boolean() }).strict().refine((value) => value.authorId === value.sponsorId);
function inspect(raw) {
  let count = 0;
  const active = /* @__PURE__ */ new Set();
  function visit(value, depth) {
    if (++count > taskDiscussionLimits.maximumNodes || depth > taskDiscussionLimits.maximumDepth) throw new TaskDiscussionError("Discussion structure exceeds its bound.", 400);
    if (typeof value === "string") {
      if (taskDiscussionCredentialLike(value)) throw new TaskDiscussionError("Credentials cannot enter discussion material.", 400);
      return;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return;
    if (!value || typeof value !== "object" || active.has(value) || Object.getOwnPropertySymbols(value).length) throw new TaskDiscussionError("Discussion material must be plain finite JSON.", 400);
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), descriptors = Object.getOwnPropertyDescriptors(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new TaskDiscussionError("Discussion material must be plain JSON.", 400);
    if (array && Object.keys(descriptors).length !== value.length + 1) throw new TaskDiscussionError("Discussion arrays must be complete.", 400);
    active.add(value);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (taskDiscussionCredentialLike(key) || !("value" in descriptor) || !descriptor.enumerable || array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) throw new TaskDiscussionError("Discussion hooks and hidden fields are refused.", 400);
      visit(descriptor.value, depth + 1);
    }
    active.delete(value);
  }
  visit(raw, 0);
}
function unchanged(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
  const a = left, b = right, keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && unchanged(a[key], b[key]));
}
function bounded2(raw, schema, maximum) {
  inspect(raw);
  if (bytes2(raw) > maximum) throw new TaskDiscussionError("Discussion material exceeds its byte bound.", 413);
  let record;
  try {
    record = schema.parse(raw);
  } catch {
    throw new TaskDiscussionError("Invalid discussion material.", 400);
  }
  if (!unchanged(raw, record)) throw new TaskDiscussionError("Discussion material must already be canonical.", 400);
  const payload = JSON.stringify(record);
  if (bytes2(record) > maximum) throw new TaskDiscussionError("Discussion material exceeds its byte bound.", 413);
  return { record, payload };
}
function boundedTaskDiscussionCommand(raw) {
  const { record: command, payload } = bounded2(raw, taskDiscussionCommandSchema, taskDiscussionLimits.requestBytes);
  return { command, payload };
}
function boundedTaskDiscussionRecord(raw) {
  return bounded2(raw, taskDiscussionRecordSchema, taskDiscussionLimits.recordBytes);
}
function boundedTaskDiscussionEvent(raw) {
  return bounded2(raw, taskDiscussionEventRecordSchema, taskDiscussionLimits.eventBytes);
}
function boundedTaskDiscussionReport(raw) {
  return bounded2(raw, taskDiscussionPrivateReportSchema, taskDiscussionLimits.reportBytes);
}
function taskDiscussionRecordForCommand(rawCommand, rawAuthor, createdAt) {
  const command = boundedTaskDiscussionCommand(rawCommand).command, author = bounded2(rawAuthor, taskDiscussionAuthorSchema, 512).record;
  if (command.action !== "publish") throw new TaskDiscussionError("This action creates no discussion message.", 400);
  return boundedTaskDiscussionRecord({ version: 1, id: command.id, requestId: command.requestId, createdAt, author, task: command.task, claim: command.claim, replyTo: command.replyTo, kind: command.kind, body: command.body, policyAccepted: command.policyAccepted, executionEnabled: false }).record;
}
function taskDiscussionEventRecordForCommand(rawCommand, rawActor, createdAt) {
  const command = boundedTaskDiscussionCommand(rawCommand).command, actor = bounded2(rawActor, taskDiscussionAuthorSchema, 512).record;
  if (command.action !== "withdraw" && command.action !== "hide") throw new TaskDiscussionError("This action creates no discussion event.", 400);
  return boundedTaskDiscussionEvent({ version: 1, task: command.task, message: command.message, actor, requestId: command.requestId, createdAt, action: command.action, expectedSequence: command.expectedSequence, sequence: command.expectedSequence + 1, state: command.action === "hide" ? "HIDDEN" : "WITHDRAWN", reason: command.reason, policyAccepted: command.policyAccepted, executionEnabled: false }).record;
}
function taskDiscussionReportForCommand(rawCommand, rawReporter, createdAt) {
  const command = boundedTaskDiscussionCommand(rawCommand).command, reporter = bounded2(rawReporter, taskDiscussionAuthorSchema, 512).record;
  if (command.action !== "report") throw new TaskDiscussionError("This action creates no private report.", 400);
  return boundedTaskDiscussionReport({ requestId: command.requestId, task: command.task, message: command.message, category: command.category, details: command.details, createdAt, reporter }).record;
}
async function validateTaskDiscussionItem(raw) {
  const item = bounded2(raw, taskDiscussionItemSchema, taskDiscussionLimits.responseBytes).record;
  if (item.record && await researchDigest(boundedTaskDiscussionRecord(item.record).payload) !== item.digest) throw new TaskDiscussionError("Discussion content digest does not match.", 400);
  for (const event of item.events) {
    const { digest: digest2, ...record } = event;
    if (await researchDigest(boundedTaskDiscussionEvent(record).payload) !== digest2) throw new TaskDiscussionError("Discussion event digest does not match.", 400);
  }
  return item;
}
async function validateTaskDiscussionGet(raw) {
  const value = bounded2(raw, taskDiscussionGetSchema, taskDiscussionLimits.responseBytes).record;
  await validateContributionTaskItem(value.task);
  await validateTaskDiscussionItem(value.item);
  return value;
}
async function validateTaskDiscussionWrite(raw, rawCommand, rawPublicAuthor) {
  const receipt = bounded2(raw, taskDiscussionWriteSchema, taskDiscussionLimits.responseBytes).record, { command, payload } = boundedTaskDiscussionCommand(rawCommand), author = bounded2(rawPublicAuthor, taskDiscussionAuthorSchema, 512).record, ack = receipt.acknowledgement;
  const fail = () => {
    throw new TaskDiscussionError("Discussion receipt does not match the original command.", 400);
  };
  if (receipt.action !== command.action || receipt.requestId !== command.requestId || !same2(ack.actor, author) || ack.commandDigest !== await researchDigest(payload) || !same2(command.task, { id: receipt.task.id, digest: receipt.task.digest })) fail();
  await validateContributionTaskItem(receipt.task);
  if (command.action === "report") {
    const report = taskDiscussionReportForCommand(command, author, ack.createdAt), expected = { requestId: report.requestId, task: report.task, message: report.message, category: report.category, createdAt: report.createdAt };
    if (!same2(receipt.report, expected) || ack.digest !== await researchDigest(boundedTaskDiscussionReport(report).payload)) fail();
    return receipt;
  }
  const item = await validateTaskDiscussionItem(receipt.message);
  if (command.action === "publish") {
    const record = taskDiscussionRecordForCommand(command, author, ack.createdAt);
    if (item.id !== command.id || item.requestId !== command.requestId || !same2(item.author, author) || receipt.task.sequence < command.expectedTaskSequence || item.digest !== await researchDigest(boundedTaskDiscussionRecord(record).payload) || item.record && !same2(item.record, record)) fail();
  } else {
    const record = taskDiscussionEventRecordForCommand(command, author, ack.createdAt), event = item.events.find((event2) => event2.requestId === command.requestId && same2(event2.actor, author));
    if (item.id !== command.message.id || item.digest !== command.message.digest || ack.sequence !== record.sequence || !event) fail();
    if (event) {
      const { digest: digest2, ...retained } = event;
      if (!same2(retained, record) || digest2 !== await researchDigest(boundedTaskDiscussionEvent(record).payload)) fail();
    }
  }
  return receipt;
}
export {
  boundedTaskDiscussionCommand,
  validateContributionTaskItem,
  validateTaskDiscussionGet,
  validateTaskDiscussionWrite
};
