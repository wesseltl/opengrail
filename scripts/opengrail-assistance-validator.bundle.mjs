/** Generated from unchanged OpenGrail models. Source snapshot 1dd7c80f46a8d7915a69f77d3ab49edbbda60989ba3834b4e2dd575c0b30f1ac. Build inputs SHA-256 a07aae2c64bf1ea586ab111255772b2635c0ce6cdec92e5e9bc73f128778f4ce. */
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
    const valueType2 = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType2._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
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
    const valueType2 = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType2._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
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
ZodMap.create = (keyType, valueType2, params) => {
  return new ZodMap({
    valueType: valueType2,
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
    const valueType2 = this._def.valueType;
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
    const elements = [...ctx.data.values()].map((item, i) => valueType2._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
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
ZodSet.create = (valueType2, params) => {
  return new ZodSet({
    valueType: valueType2,
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
  let reason2 = null;
  item.moderation.forEach((event, index) => {
    if (event.sequence !== index + 1 || current === "WITHDRAWN" || Date.parse(event.createdAt) < Date.parse(index ? item.moderation[index - 1].createdAt : item.createdAt)) bad("Moderation history is inconsistent.");
    current = event.state;
    reason2 = event.reason;
  });
  if (current !== item.state || reason2 !== item.reason) bad("Public state must match its retained events.");
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
var ResearchError = class extends Error {
  constructor(message, status = 409, retryAfterSeconds) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
  status;
  retryAfterSeconds;
};
async function researchDigest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function researchAuthorReference(author) {
  return researchAuthorReferenceSchema.parse(author.kind === "HUMAN" ? author : { kind: "AGENT", id: author.id, sponsorId: author.sponsorId });
}
function boundedResearchRecord(raw) {
  const record = researchRecordSchema.parse(raw), payload = JSON.stringify(record);
  if (new TextEncoder().encode(payload).byteLength > researchLimits.payloadBytes) throw new ResearchError("Research content is too large.", 413);
  return { record, payload };
}

// app/program-wasm.ts
var programWasmLimits = Object.freeze({ moduleBytes: 4096, types: 32, functions: 32, parameters: 16, locals: 128, globals: 64, instructions: 8192, nesting: 32, callDepth: 16, operandStack: 256, memoryPages: 1, fuel: 2e4 });
var ProgramWasmError = class extends Error {
  code;
  fuelUsed;
  constructor(code, message, fuelUsed = null) {
    super(message);
    this.name = "ProgramWasmError";
    this.code = code;
    this.fuelUsed = fuelUsed;
  }
};
var fail = (code, message) => {
  throw new ProgramWasmError(code, message);
};
var modules = /* @__PURE__ */ new WeakMap();
var finite = (value) => Number.isFinite(value) ? value : fail("NONFINITE", "The numeric profile forbids non-finite values.");
var Reader = class {
  bytes;
  position = 0;
  constructor(bytes2) {
    this.bytes = bytes2;
  }
  get remaining() {
    return this.bytes.length - this.position;
  }
  byte() {
    if (!this.remaining) fail("BINARY", "Unexpected end of module.");
    return this.bytes[this.position++];
  }
  take(length) {
    if (!Number.isInteger(length) || length < 0 || length > this.remaining) fail("BINARY", "Truncated binary section.");
    const result = this.bytes.slice(this.position, this.position + length);
    this.position += length;
    return result;
  }
  u32() {
    let result = 0;
    for (let i = 0; i < 5; i++) {
      const byte = this.byte(), payload = byte & 127;
      if (i === 4 && payload > 15) fail("BINARY", "Unsigned LEB exceeds 32 bits.");
      result += payload * 2 ** (i * 7);
      if (!(byte & 128)) return result;
    }
    return fail("BINARY", "Unsigned LEB is too long.");
  }
  i32() {
    let result = 0;
    for (let i = 0; i < 5; i++) {
      const byte = this.byte(), payload = byte & 127;
      result += payload * 2 ** (i * 7);
      if (!(byte & 128)) {
        if (byte & 64) result -= 2 ** ((i + 1) * 7);
        if (result < -2147483648 || result > 2147483647) fail("BINARY", "Signed LEB exceeds 32 bits.");
        return result;
      }
    }
    return fail("BINARY", "Signed LEB is too long.");
  }
  f64() {
    const bytes2 = this.take(8);
    return finite(new DataView(bytes2.buffer, bytes2.byteOffset, 8).getFloat64(0, true));
  }
  name() {
    const size = this.u32();
    if (size > 128) fail("LIMIT", "Binary names exceed the profile bound.");
    try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(this.take(size));
    } catch (error) {
      if (error instanceof ProgramWasmError) throw error;
      return fail("BINARY", "Invalid UTF-8 name.");
    }
  }
  count(limit, label) {
    const count = this.u32();
    if (count > limit) fail("LIMIT", `${label} exceeds the profile bound.`);
    return count;
  }
  done() {
    if (this.remaining) fail("BINARY", "Unexpected trailing section bytes.");
  }
};
var valueType = (reader) => {
  const byte = reader.byte();
  if (byte === 127) return "i32";
  if (byte === 124) return "f64";
  return fail("UNSUPPORTED", "Only i32 and f64 values are admitted.");
};
var simpleOps = /* @__PURE__ */ new Set([0, 1, 15, 26, 27, ...Array.from({ length: 11 }, (_, i) => 69 + i), ...Array.from({ length: 6 }, (_, i) => 97 + i), ...Array.from({ length: 18 }, (_, i) => 103 + i), ...Array.from({ length: 14 }, (_, i) => 153 + i), 170, 171, 183, 184, 192, 193]);
var memoryWidths = /* @__PURE__ */ new Map([[40, 4], [43, 8], [44, 1], [45, 1], [46, 2], [47, 2], [54, 4], [57, 8], [58, 1], [59, 2]]);
var loadOps = /* @__PURE__ */ new Set([40, 43, 44, 45, 46, 47]);
var storeOps = /* @__PURE__ */ new Set([54, 57, 58, 59]);
function parseInstructions(reader, counter, depth, allowElse) {
  if (depth > programWasmLimits.nesting) fail("LIMIT", "Structured control nesting exceeds the profile bound.");
  const instructions = [];
  for (; ; ) {
    const op = reader.byte();
    if (op === 11) return { instructions, elseSeen: false };
    if (op === 5) {
      if (!allowElse) fail("BINARY", "Unexpected else.");
      return { instructions, elseSeen: true };
    }
    if (++counter.count > programWasmLimits.instructions) fail("LIMIT", "Instruction count exceeds the profile bound.");
    const instruction = { op };
    if (op === 2 || op === 3 || op === 4) {
      const blockType = reader.byte();
      if (blockType === 127) instruction.result = "i32";
      else if (blockType === 124) instruction.result = "f64";
      else if (blockType !== 64) fail("UNSUPPORTED", "Indexed or multi-value block types are not admitted.");
      const body = parseInstructions(reader, counter, depth + 1, op === 4);
      instruction.body = body.instructions;
      if (body.elseSeen) {
        const other = parseInstructions(reader, counter, depth + 1, false);
        instruction.otherwise = other.instructions;
      }
      instructions.push(instruction);
      continue;
    }
    if (op === 12 || op === 13 || op === 16 || op >= 32 && op <= 36) instruction.arg = reader.u32();
    else if (memoryWidths.has(op)) {
      instruction.align = reader.u32();
      instruction.offset = reader.u32();
      const width = memoryWidths.get(op);
      if (instruction.align > Math.log2(width)) fail("TYPE", "Memory alignment exceeds the natural alignment.");
    } else if (op === 63 || op === 64) {
      if (reader.u32() !== 0) fail("UNSUPPORTED", "Only memory zero is admitted.");
    } else if (op === 65) instruction.arg = reader.i32();
    else if (op === 68) instruction.arg = reader.f64();
    else if (!simpleOps.has(op)) fail("UNSUPPORTED", `Unsupported WASM opcode 0x${op.toString(16)}.`);
    instructions.push(instruction);
  }
}
function validateFunction(module, func) {
  const signature = module.types[func.type], locals = [...signature.params, ...func.locals], stack = [], controls = [];
  const current = () => controls[controls.length - 1];
  const push = (type) => {
    if (stack.length >= programWasmLimits.operandStack) fail("LIMIT", "Validated operand stack exceeds the profile bound.");
    stack.push(type);
  };
  const pop = (expected) => {
    const control = current();
    if (stack.length === control.height) {
      if (control.unreachable) return expected ?? "unknown";
      return fail("TYPE", "Operand stack underflow.");
    }
    const actual = stack.pop();
    if (expected && actual !== "unknown" && actual !== expected) fail("TYPE", "Operand type mismatch.");
    return actual;
  };
  const popTypes = (types) => {
    for (let i = types.length - 1; i >= 0; i--) pop(types[i]);
  };
  const dead = () => {
    stack.length = current().height;
    current().unreachable = true;
  };
  const sequence = (instructions) => {
    for (const instruction of instructions) {
      const { op, arg } = instruction;
      if (op === 0) {
        dead();
        continue;
      }
      if (op === 1) continue;
      if (op === 2 || op === 3 || op === 4) {
        if (op === 4) pop("i32");
        const result = instruction.result ? [instruction.result] : [], height = stack.length;
        const validateArm = (body) => {
          controls.push({ height, result, label: op === 3 ? [] : result, unreachable: false });
          sequence(body);
          popTypes(result);
          if (stack.length !== height) fail("TYPE", "Structured block leaves unexpected operands.");
          controls.pop();
          stack.length = height;
        };
        validateArm(instruction.body);
        if (op === 4) {
          if (!instruction.otherwise && result.length) fail("TYPE", "A result-bearing if requires an else.");
          validateArm(instruction.otherwise ?? []);
        }
        for (const type of result) push(type);
        continue;
      }
      if (op === 12 || op === 13) {
        if (arg >= controls.length) fail("TYPE", "Branch label is outside the function.");
        if (op === 13) pop("i32");
        const label = controls[controls.length - 1 - arg].label;
        popTypes(label);
        if (op === 13) {
          for (const type of label) push(type);
        } else dead();
        continue;
      }
      if (op === 15) {
        popTypes(signature.results);
        dead();
        continue;
      }
      if (op === 16) {
        const called = module.functions[arg];
        if (!called) fail("TYPE", "Unknown direct function.");
        const type = module.types[called.type];
        popTypes(type.params);
        for (const result of type.results) push(result);
        continue;
      }
      if (op === 26) {
        pop();
        continue;
      }
      if (op === 27) {
        pop("i32");
        const right = pop(), left = pop();
        if (left !== "unknown" && right !== "unknown" && left !== right) fail("TYPE", "Select operands have different types.");
        push(left === "unknown" ? right : left);
        continue;
      }
      if (op >= 32 && op <= 34) {
        const type = locals[arg];
        if (!type) fail("TYPE", "Unknown local.");
        if (op !== 32) pop(type);
        if (op !== 33) push(type);
        continue;
      }
      if (op === 35 || op === 36) {
        const global = module.globals[arg];
        if (!global) fail("TYPE", "Unknown global.");
        if (op === 35) push(global.type);
        else {
          if (!global.mutable) fail("TYPE", "Cannot set an immutable global.");
          pop(global.type);
        }
        continue;
      }
      if (memoryWidths.has(op)) {
        if (!module.memory) fail("TYPE", "Memory instruction requires a declared memory.");
        const type = op === 43 || op === 57 ? "f64" : "i32";
        if (storeOps.has(op)) pop(type);
        pop("i32");
        if (loadOps.has(op)) push(type);
        continue;
      }
      if (op === 63 || op === 64) {
        if (!module.memory) fail("TYPE", "Memory instruction requires a declared memory.");
        if (op === 64) pop("i32");
        push("i32");
        continue;
      }
      if (op === 65) {
        push("i32");
        continue;
      }
      if (op === 68) {
        push("f64");
        continue;
      }
      if (op === 69) {
        pop("i32");
        push("i32");
        continue;
      }
      if (op >= 70 && op <= 79) {
        pop("i32");
        pop("i32");
        push("i32");
        continue;
      }
      if (op >= 97 && op <= 102) {
        pop("f64");
        pop("f64");
        push("i32");
        continue;
      }
      if (op >= 103 && op <= 105 || op === 192 || op === 193) {
        pop("i32");
        push("i32");
        continue;
      }
      if (op >= 106 && op <= 120) {
        pop("i32");
        pop("i32");
        push("i32");
        continue;
      }
      if (op >= 153 && op <= 159) {
        pop("f64");
        push("f64");
        continue;
      }
      if (op >= 160 && op <= 166) {
        pop("f64");
        pop("f64");
        push("f64");
        continue;
      }
      if (op === 170 || op === 171) {
        pop("f64");
        push("i32");
        continue;
      }
      if (op === 183 || op === 184) {
        pop("i32");
        push("f64");
        continue;
      }
      fail("UNSUPPORTED", "Unimplemented validated opcode.");
    }
  };
  controls.push({ height: 0, result: signature.results, label: signature.results, unreachable: false });
  sequence(func.body);
  popTypes(signature.results);
  if (stack.length) fail("TYPE", "Function leaves unexpected operands.");
  controls.pop();
}
function parseProgramModule(bytes2) {
  if (!(bytes2 instanceof Uint8Array)) fail("ARGUMENT", "Module bytes must be a Uint8Array.");
  if (bytes2.byteLength > programWasmLimits.moduleBytes) fail("LIMIT", "Module bytes exceed the profile bound.");
  const reader = new Reader(new Uint8Array(bytes2));
  if (reader.take(8).some((byte, index) => byte !== [0, 97, 115, 109, 1, 0, 0, 0][index])) fail("BINARY", "Invalid WASM magic or version.");
  const module = { types: [], functions: [], globals: [], memory: null, data: [], exports: /* @__PURE__ */ new Map() }, functionTypes = [], counter = { count: 0 };
  let lastSection = 0, hasCode = false;
  while (reader.remaining) {
    const id2 = reader.byte(), section = new Reader(reader.take(reader.u32()));
    if (id2 === 0) {
      section.name();
      section.take(section.remaining);
      continue;
    }
    if (id2 > 11) fail("UNSUPPORTED", "Unsupported binary section.");
    if (id2 <= lastSection) fail("BINARY", "Non-custom sections must be unique and ordered.");
    lastSection = id2;
    if (id2 === 1) {
      const count = section.count(programWasmLimits.types, "Types");
      for (let i = 0; i < count; i++) {
        if (section.byte() !== 96) fail("UNSUPPORTED", "Only numeric function types are admitted.");
        const params = Array.from({ length: section.count(programWasmLimits.parameters, "Parameters") }, () => valueType(section)), results = Array.from({ length: section.count(1, "Results") }, () => valueType(section));
        module.types.push({ params, results });
      }
    } else if (id2 === 2 || id2 === 4 || id2 === 8 || id2 === 9) fail("UNSUPPORTED", "Imports, tables, start and element sections are forbidden.");
    else if (id2 === 3) {
      const count = section.count(programWasmLimits.functions, "Functions");
      for (let i = 0; i < count; i++) {
        const type = section.u32();
        if (!module.types[type]) fail("TYPE", "Unknown function type.");
        functionTypes.push(type);
      }
    } else if (id2 === 5) {
      const count = section.count(1, "Memories");
      if (count) {
        if (section.byte() !== 1) fail("UNSUPPORTED", "Memory requires a non-shared explicit maximum.");
        const initial = section.u32(), maximum = section.u32();
        if (initial > maximum || maximum > programWasmLimits.memoryPages) fail("LIMIT", "Memory exceeds the one-page profile bound.");
        module.memory = { initial, maximum };
      }
    } else if (id2 === 6) {
      const count = section.count(programWasmLimits.globals, "Globals");
      for (let i = 0; i < count; i++) {
        const type = valueType(section), mutable = section.byte();
        if (mutable > 1) fail("BINARY", "Invalid global mutability.");
        const op = section.byte();
        if (op !== (type === "i32" ? 65 : 68)) fail("TYPE", "Global initializer must be a matching numeric constant.");
        const value = type === "i32" ? section.i32() : section.f64();
        if (section.byte() !== 11) fail("BINARY", "Invalid global initializer terminator.");
        module.globals.push({ type, mutable: mutable === 1, value });
      }
    } else if (id2 === 7) {
      const count = section.count(3, "Exports");
      for (let i = 0; i < count; i++) {
        const name = section.name(), kind2 = section.byte(), index = section.u32();
        if (module.exports.has(name)) fail("BINARY", "Duplicate export name.");
        if (name === "memory") {
          if (kind2 !== 2 || index !== 0 || !module.memory) fail("ABI", "Invalid memory export.");
        } else if (name === "on_bar" || name === "configure") {
          if (kind2 !== 0) fail("ABI", "ABI exports must be functions.");
        } else fail("ABI", "Unknown exported capability.");
        module.exports.set(name, index);
      }
    } else if (id2 === 10) {
      hasCode = true;
      const count = section.count(programWasmLimits.functions, "Code bodies");
      if (count !== functionTypes.length) fail("BINARY", "Function and code counts differ.");
      for (let i = 0; i < count; i++) {
        const body = new Reader(section.take(section.u32())), locals = [], groups = body.count(programWasmLimits.locals, "Local groups");
        for (let group = 0; group < groups; group++) {
          const count2 = body.count(programWasmLimits.locals, "Expanded locals"), type = valueType(body);
          if (locals.length + count2 + module.types[functionTypes[i]].params.length > programWasmLimits.locals) fail("LIMIT", "Expanded locals exceed the profile bound.");
          for (let j = 0; j < count2; j++) locals.push(type);
        }
        const instructions = parseInstructions(body, counter, 0, false);
        body.done();
        module.functions.push({ type: functionTypes[i], locals, body: instructions.instructions });
      }
    } else if (id2 === 11) {
      const count = section.count(32, "Data segments");
      for (let i = 0; i < count; i++) {
        const flags = section.u32();
        if (flags !== 0 && flags !== 2) fail("UNSUPPORTED", "Only active data segments are admitted.");
        if (flags === 2 && section.u32() !== 0) fail("UNSUPPORTED", "Only memory zero is admitted.");
        const memory = module.memory ?? fail("TYPE", "Data segment requires memory.");
        if (section.byte() !== 65) fail("UNSUPPORTED", "Data offset must be an i32 constant.");
        const offset = section.i32() >>> 0;
        if (section.byte() !== 11) fail("BINARY", "Invalid data offset expression.");
        const data = section.take(section.u32());
        if (offset + data.length > memory.initial * 65536) fail("MEMORY", "Active data segment exceeds initial memory.");
        module.data.push({ offset, bytes: data });
      }
    }
    section.done();
  }
  if (!hasCode || module.functions.length !== functionTypes.length) fail("BINARY", "Missing function code.");
  const checkExport = (name, params, results, required) => {
    const index = module.exports.get(name);
    if (index === void 0) {
      if (required) fail("ABI", `Missing ${name} export.`);
      return;
    }
    const func = module.functions[index];
    if (!func) fail("TYPE", "Export refers to an unknown function.");
    const type = module.types[func.type];
    if (type.params.join(",") !== params.join(",") || type.results.join(",") !== results.join(",")) fail("ABI", `Incorrect ${name} signature.`);
  };
  checkExport("on_bar", ["i32", "f64", "f64", "f64", "f64", "f64", "f64"], ["i32"], true);
  checkExport("configure", ["i32", "f64"], [], false);
  for (const func of module.functions) validateFunction(module, func);
  const handle = Object.freeze({});
  modules.set(handle, module);
  return handle;
}

// app/program-source-model.ts
var programProfile = "opengrail-wasm-i32-f64-v1";
var programAbi = "opengrail-causal-signal-wasm-v1";
var programSourceLimits = { moduleBytes: 4096, parameters: 16, parameterMagnitude: 1e12 };
function programSourceBytes(bytesHex) {
  if (typeof bytesHex !== "string" || bytesHex.length < 16 || bytesHex.length > programSourceLimits.moduleBytes * 2 || !/^([a-f0-9]{2})+$/.test(bytesHex)) throw new ProgramSourceError("The program must use bounded canonical lowercase binary hex.");
  const bytes2 = new Uint8Array(bytesHex.length / 2);
  for (let n = 0; n < bytes2.length; n++) bytes2[n] = Number.parseInt(bytesHex.slice(n * 2, n * 2 + 2), 16);
  return bytes2;
}
function hasRecognizableCredentials(bytes2) {
  let text5 = new TextDecoder().decode(bytes2);
  for (let n = 0; n < 32; n++) {
    if (/og_(?:agent|local_owner|local_producer)_/i.test(text5)) return true;
    const decoded = text5.replace(/%[a-f0-9]{2}/gi, (escape) => String.fromCharCode(Number.parseInt(escape.slice(1), 16)));
    if (decoded === text5) return false;
    text5 = decoded;
  }
  throw new ProgramSourceError("Program byte metadata exceeds bounded credential inspection.");
}
var programSourceSchema = external_exports.object({ profile: external_exports.literal(programProfile), abi: external_exports.literal(programAbi), bytesHex: external_exports.string().min(16).max(programSourceLimits.moduleBytes * 2).regex(/^([a-f0-9]{2})+$/), digest: external_exports.string().regex(/^[a-f0-9]{64}$/), parameters: external_exports.array(external_exports.number().finite().min(-programSourceLimits.parameterMagnitude).max(programSourceLimits.parameterMagnitude).refine((value) => !Object.is(value, -0), "Program parameters require canonical positive zero.")).max(programSourceLimits.parameters) }).strict().superRefine((source, ctx) => {
  try {
    const bytes2 = programSourceBytes(source.bytesHex);
    if (hasRecognizableCredentials(bytes2)) throw new ProgramSourceError("Credentials cannot be retained in public program bytes.");
    parseProgramModule(bytes2);
  } catch {
    ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["bytesHex"], message: "The program is invalid or unsupported by the restricted binary profile and ABI." });
  }
});
var ProgramSourceError = class extends Error {
  constructor(message) {
    super(message);
  }
};
async function programBinaryDigest(bytesHex) {
  const bytes2 = programSourceBytes(bytesHex), digest2 = await crypto.subtle.digest("SHA-256", bytes2);
  return Array.from(new Uint8Array(digest2), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function verifyProgramSource(raw) {
  const source = programSourceSchema.parse(raw);
  if (await programBinaryDigest(source.bytesHex) !== source.digest) throw new ProgramSourceError("The exact raw program binary digest does not match.");
  return source;
}

// app/strategy-model.ts
var strategySourceSchema = researchSourceSchema;
var strategyAuthorSchema = researchAuthorSchema;
var strategyAuthorReferenceSchema = researchAuthorReferenceSchema;
var strategyAuthorReference = researchAuthorReference;
var strategyLimits = { requestBytes: 32768, payloadBytes: 28672, publishPerSponsorDay: 10, stored: 1e3, revisions: 32, eventsPerRecord: 16, reportsPerSponsorDay: 10, reportsStored: 1e3, page: 20 };
var uuid2 = external_exports.string().uuid().refine((value) => value === value.toLowerCase());
var hash2 = external_exports.string().regex(/^[a-f0-9]{64}$/);
var humanId2 = external_exports.string().regex(/^human_[a-f0-9]{64}$/);
var clock2 = external_exports.string().datetime().refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
var text3 = (maximum, minimum = 1) => external_exports.string().trim().min(minimum).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine((value) => !tokenLike2(value), "Agent credentials cannot be published.");
function tokenLike2(value) {
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
var policy2 = external_exports.literal("public-strategy-v1");
var finite2 = (minimum, maximum) => external_exports.number().finite().min(minimum).max(maximum);
var strategyEntrySchema = external_exports.discriminatedUnion("type", [
  external_exports.object({ type: external_exports.literal("TREND"), fastPeriod: external_exports.number().int().min(2).max(100), slowPeriod: external_exports.number().int().min(3).max(300), confirmation: external_exports.enum(["CROSS", "ALIGNED"]) }).strict(),
  external_exports.object({ type: external_exports.literal("RSI"), period: external_exports.number().int().min(2).max(100), threshold: finite2(1, 99), comparison: external_exports.enum(["BELOW", "ABOVE"]) }).strict(),
  external_exports.object({ type: external_exports.literal("BREAKOUT"), lookback: external_exports.number().int().min(2).max(300) }).strict(),
  external_exports.object({ type: external_exports.literal("DCA"), intervalBars: external_exports.number().int().min(1).max(500), maxEntries: external_exports.number().int().min(1).max(10) }).strict(),
  external_exports.object({ type: external_exports.literal("GRID"), lowerPrice: external_exports.number().finite().positive().max(1e9), upperPrice: external_exports.number().finite().positive().max(1e9), levels: external_exports.number().int().min(2).max(30) }).strict(),
  external_exports.object({ type: external_exports.literal("SIGNAL"), provider: external_exports.enum(["ALTFINS", "TRADINGVIEW", "CUSTOM"]), event: external_exports.enum(["BULLISH", "BEARISH"]), maxAgeBars: external_exports.number().int().min(1).max(50) }).strict(),
  external_exports.object({ type: external_exports.literal("RULES"), match: external_exports.enum(["ALL", "ANY"]), conditions: external_exports.array(external_exports.object({ indicator: external_exports.enum(["PRICE_SMA", "RSI", "RETURN"]), period: external_exports.number().int().min(2).max(300), comparison: external_exports.enum(["GT", "LT", "CROSSES_ABOVE", "CROSSES_BELOW"]), threshold: finite2(-100, 1e6) }).strict()).min(1).max(8) }).strict()
]);
var strategyDefinitionSchema = external_exports.object({ schemaVersion: external_exports.literal(1), market: external_exports.object({ symbol: external_exports.string().regex(/^[A-Z0-9]{2,12}\/[A-Z0-9]{2,12}$/), timeframe: external_exports.enum(["5m", "15m", "1h", "4h", "1d"]), direction: external_exports.enum(["LONG", "SHORT"]) }).strict(), entry: strategyEntrySchema, risk: external_exports.object({ positionPct: finite2(0.1, 10), maxOpenPositions: external_exports.number().int().min(1).max(5), stopLossPct: finite2(0.1, 20), takeProfitPct: finite2(0.1, 100), maxDailyLossPct: finite2(0.1, 5) }).strict(), costs: external_exports.object({ feeBps: finite2(0, 100), slippageBps: finite2(0, 200) }).strict(), execution: external_exports.object({ mode: external_exports.literal("DEMO"), leverage: external_exports.literal(1), ordersEnabled: external_exports.literal(false) }).strict() }).strict().superRefine((definition, ctx) => {
  const entry = definition.entry;
  if (entry.type === "TREND" && entry.fastPeriod >= entry.slowPeriod) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["entry", "fastPeriod"], message: "The fast period must be less than the slow period." });
  if (entry.type === "GRID" && entry.lowerPrice >= entry.upperPrice) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["entry", "lowerPrice"], message: "The grid lower price must be less than the upper price." });
  if (entry.type === "SIGNAL" && entry.event === "BULLISH" !== (definition.market.direction === "LONG")) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["market", "direction"], message: "The signal event must agree with the market direction." });
});
var strategyRelationSchema = external_exports.object({ type: external_exports.enum(["REVISION", "FORK"]), id: uuid2, digest: hash2 }).strict();
var contentFields2 = { name: text3(120), description: text3(3e3), assumptions: text3(1500), falsification: text3(2e3), sources: external_exports.array(strategySourceSchema).max(8), definition: strategyDefinitionSchema, relation: strategyRelationSchema.nullable() };
var strategyPublishV1Schema = external_exports.object({ action: external_exports.literal("publish"), requestId: uuid2, id: uuid2, ...contentFields2, policyAccepted: policy2 }).strict().refine((command) => command.relation?.id !== command.id, "A strategy cannot reference itself.");
var strategyPublishV2Schema = external_exports.object({ action: external_exports.literal("publish"), version: external_exports.literal(2), requestId: uuid2, id: uuid2, ...contentFields2, program: programSourceSchema, policyAccepted: policy2 }).strict().superRefine((command, ctx) => {
  if (command.relation?.id === command.id) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["relation"], message: "A strategy cannot reference itself." });
  if (command.definition.entry.type !== "SIGNAL" || command.definition.entry.provider !== "CUSTOM" || command.definition.entry.maxAgeBars !== 1) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["definition", "entry"], message: "Program sources require causal CUSTOM signals with maxAgeBars 1." });
});
var strategyPublishSchema = external_exports.union([strategyPublishV1Schema, strategyPublishV2Schema]);
var common2 = { requestId: uuid2, id: uuid2, digest: hash2, policyAccepted: policy2 };
var strategyWithdrawSchema = external_exports.object({ action: external_exports.literal("withdraw"), ...common2, reason: external_exports.enum(["AUTHOR_REQUEST", "SPONSOR_REQUEST", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE"]) }).strict();
var strategyReportSchema = external_exports.object({ action: external_exports.literal("report"), ...common2, reason: external_exports.enum(["SPAM", "ABUSE", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE", "MISLEADING", "OTHER"]), details: text3(1500) }).strict();
var strategyModerateSchema = external_exports.object({ action: external_exports.literal("moderate"), ...common2, state: external_exports.enum(["VISIBLE", "HIDDEN"]), reason: external_exports.enum(["SPAM", "ABUSE", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE", "MISLEADING", "POLICY", "RESTORED"]) }).strict().refine((command) => command.state === "VISIBLE" === (command.reason === "RESTORED"), "Restoration uses RESTORED; hiding uses a policy reason.");
var strategyCommandSchema = external_exports.union([strategyPublishSchema, strategyWithdrawSchema, strategyReportSchema, strategyModerateSchema]);
var strategyRecordV1Schema = external_exports.object({ version: external_exports.literal(1), id: uuid2, rootId: uuid2, revision: external_exports.number().int().min(1).max(strategyLimits.revisions), requestId: uuid2, createdAt: clock2, author: strategyAuthorSchema, content: external_exports.object(contentFields2).strict(), policyAccepted: policy2, verification: external_exports.literal("UNTESTED"), executionEnabled: external_exports.literal(false) }).strict().superRefine((record, ctx) => {
  if (record.author.kind === "HUMAN" && record.author.id !== record.author.sponsorId) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["author"], message: "A human is their own sponsor." });
  if (record.revision === 1 !== (record.rootId === record.id)) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["rootId"], message: "Only the first revision creates its own root." });
  if (record.revision > 1 !== (record.content.relation?.type === "REVISION")) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["revision"], message: "Revisions must reference a prior revision." });
  const command = strategyPublishV1Schema.safeParse({ action: "publish", requestId: record.requestId, id: record.id, ...record.content, policyAccepted: record.policyAccepted });
  if (!command.success) command.error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ["content", ...issue.path] }));
});
var strategyRecordV2Schema = external_exports.object({ version: external_exports.literal(2), id: uuid2, rootId: uuid2, revision: external_exports.number().int().min(1).max(strategyLimits.revisions), requestId: uuid2, createdAt: clock2, author: strategyAuthorSchema, content: external_exports.object({ ...contentFields2, program: programSourceSchema }).strict(), policyAccepted: policy2, verification: external_exports.literal("UNTESTED"), executionEnabled: external_exports.literal(false) }).strict().superRefine((record, ctx) => {
  if (record.author.kind === "HUMAN" && record.author.id !== record.author.sponsorId) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["author"], message: "A human is their own sponsor." });
  if (record.revision === 1 !== (record.rootId === record.id)) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["rootId"], message: "Only the first revision creates its own root." });
  if (record.revision > 1 !== (record.content.relation?.type === "REVISION")) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["revision"], message: "Revisions must reference a prior revision." });
  const command = strategyPublishV2Schema.safeParse({ action: "publish", version: 2, requestId: record.requestId, id: record.id, ...record.content, policyAccepted: record.policyAccepted });
  if (!command.success) command.error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ["content", ...issue.path] }));
});
var strategyRecordSchema = external_exports.union([strategyRecordV1Schema, strategyRecordV2Schema]);
var state2 = external_exports.enum(["VISIBLE", "HIDDEN", "WITHDRAWN"]);
var safeReason2 = external_exports.enum(["AUTHOR_REQUEST", "SPONSOR_REQUEST", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE", "SPAM", "ABUSE", "MISLEADING", "POLICY", "RESTORED"]);
var strategyPublicEventSchema = external_exports.object({ sequence: external_exports.number().int().min(1).max(strategyLimits.eventsPerRecord), requestId: uuid2, createdAt: clock2, actor: strategyAuthorReferenceSchema, state: state2, reason: safeReason2 }).strict();
var strategyPublicItemSchema = external_exports.object({ id: uuid2, digest: hash2, rootId: uuid2, revision: external_exports.number().int().min(1).max(strategyLimits.revisions), requestId: uuid2, createdAt: clock2, author: strategyAuthorReferenceSchema, state: state2, reason: safeReason2.nullable(), record: strategyRecordSchema.nullable(), moderation: external_exports.array(strategyPublicEventSchema).max(strategyLimits.eventsPerRecord) }).strict().superRefine((item, ctx) => {
  const bad = (message) => ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message });
  if (item.state === "VISIBLE" !== (item.record !== null)) bad("Non-visible strategy must be a content-free tombstone.");
  if (item.record && (item.id !== item.record.id || item.rootId !== item.record.rootId || item.revision !== item.record.revision || item.requestId !== item.record.requestId || item.createdAt !== item.record.createdAt || JSON.stringify(item.author) !== JSON.stringify(strategyAuthorReference(item.record.author)))) bad("Public identity must match the retained record.");
  let current = "VISIBLE";
  let reason2 = null;
  item.moderation.forEach((event, index) => {
    if (event.sequence !== index + 1 || current === "WITHDRAWN" || Date.parse(event.createdAt) < Date.parse(index ? item.moderation[index - 1].createdAt : item.createdAt)) bad("Moderation history is inconsistent.");
    current = event.state;
    reason2 = event.reason;
  });
  if (current !== item.state || reason2 !== item.reason) bad("Public state must match its retained events.");
});
var strategyListSchema = external_exports.object({ version: external_exports.literal(1), items: external_exports.array(strategyPublicItemSchema).max(strategyLimits.page), nextCursor: uuid2.nullable(), executionEnabled: external_exports.literal(false) }).strict();
var strategyGetSchema = external_exports.object({ version: external_exports.literal(1), item: strategyPublicItemSchema, executionEnabled: external_exports.literal(false) }).strict();
var strategyHistorySchema = external_exports.object({ version: external_exports.literal(1), items: external_exports.array(strategyPublicItemSchema).max(strategyLimits.revisions), executionEnabled: external_exports.literal(false) }).strict();
var strategyPrivateReportSchema = external_exports.object({ requestId: uuid2, id: uuid2, digest: hash2, reason: strategyReportSchema.shape.reason, details: text3(1500), createdAt: clock2, reporter: strategyAuthorReferenceSchema }).strict();
var strategyReportReceiptSchema = strategyPrivateReportSchema.omit({ details: true, reporter: true });
var strategyReportsSchema = external_exports.object({ version: external_exports.literal(1), reports: external_exports.array(strategyPrivateReportSchema).max(strategyLimits.page), nextCursor: hash2.nullable(), executionEnabled: external_exports.literal(false) }).strict();
var strategyWriteSchema = external_exports.object({ version: external_exports.literal(1), action: external_exports.enum(["publish", "withdraw", "report", "moderate"]), requestId: uuid2, item: strategyPublicItemSchema.nullable(), report: strategyReportReceiptSchema.nullable(), executionEnabled: external_exports.literal(false) }).strict().refine((value) => value.action === "report" ? value.item === null && value.report?.requestId === value.requestId : value.item !== null && value.report === null, "Write receipts must match their action.");
var strategyMeSchema = external_exports.object({ version: external_exports.literal(1), authorId: humanId2, sponsorId: humanId2, moderator: external_exports.boolean(), executionEnabled: external_exports.literal(false) }).strict().refine((value) => value.authorId === value.sponsorId);
var StrategyError = class extends Error {
  constructor(message, status = 409, retryAfterSeconds) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
  status;
  retryAfterSeconds;
};
function boundedStrategyRecord(raw) {
  const record = strategyRecordSchema.parse(raw), payload = JSON.stringify(record);
  if (new TextEncoder().encode(payload).byteLength > strategyLimits.payloadBytes) throw new StrategyError("Strategy content is too large.", 413);
  return { record, payload };
}
async function verifyStrategyProgram(value) {
  if ("version" in value && value.version === 2) await verifyProgramSource("content" in value ? value.content.program : value.program);
}

// app/assistance-model.ts
var assistanceLimits = { requestBytes: 16384, recordBytes: 12288, responseBytes: 524288, maximumDepth: 12, maximumNodes: 8192, page: 12, publishPerSponsorDay: 10, stored: 1e3, reportsPerSponsorDay: 10, reportsStored: 1e3, eventsPerRecord: 16, responsesPerRequest: 32, reportBytes: 4096 };
var assistancePolicy = "public-assistance-v1";
var AssistanceError = class extends Error {
  constructor(message, status = 409, retryAfterSeconds) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
  status;
  retryAfterSeconds;
};
var uuid3 = external_exports.string().length(36).regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
var hash3 = external_exports.string().length(64).regex(/^[a-f0-9]{64}$/);
var clock3 = external_exports.string().datetime().refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
var authorReference = researchAuthorReferenceSchema.refine((value) => value.kind === "HUMAN" ? value.id.length === 70 && value.sponsorId.length === 70 : uuid3.safeParse(value.id).success && value.sponsorId.length === 70);
var fullAuthor = researchAuthorSchema.refine((value) => value.kind === "HUMAN" ? value.id.length === 70 && value.sponsorId === value.id : uuid3.safeParse(value.id).success && value.sponsorId.length === 70);
function credential(value) {
  for (let n = 0; n < 32; n++) {
    if (/og_(?:agent|local_(?:producer|owner))_/i.test(value)) return true;
    const next = value.replace(/(?:%[a-f0-9]{2})+/gi, (run) => {
      try {
        return decodeURIComponent(run);
      } catch {
        return run.replace(/%([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      }
    });
    if (next === value) return false;
    value = next;
  }
  return true;
}
var text4 = (maximum, minimum = 1) => external_exports.string().min(minimum).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine((value) => value === value.trim() && !credential(value));
var assistanceReferenceSchema = external_exports.object({ id: uuid3, digest: hash3 }).strict();
var policy3 = external_exports.literal(assistancePolicy);
var withdrawReasons = ["AUTHOR_REQUEST", "SPONSOR_REQUEST", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE"];
var reportReasons = ["SPAM", "ABUSE", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE", "MISLEADING", "OTHER"];
var moderationReasons = ["SPAM", "ABUSE", "PERSONAL_DATA", "CREDENTIAL_EXPOSURE", "MISLEADING", "POLICY", "RESTORED"];
var common3 = { requestId: uuid3, id: uuid3, policyAccepted: policy3 };
var assistanceRequestSchema = external_exports.object({ action: external_exports.literal("request"), requestId: uuid3, id: uuid3, base: assistanceReferenceSchema, intent: text4(2e3), constraints: text4(1e3), falsification: text4(1e3), policyAccepted: policy3 }).strict();
var assistanceRespondSchema = external_exports.object({ action: external_exports.literal("respond"), requestId: uuid3, id: uuid3, request: assistanceReferenceSchema, proposal: assistanceReferenceSchema, rationale: text4(1500), questions: text4(1e3, 0), policyAccepted: policy3 }).strict().refine((value) => value.id !== value.request.id);
var assistanceWithdrawSchema = external_exports.object({ action: external_exports.literal("withdraw"), ...common3, digest: hash3, reason: external_exports.enum(withdrawReasons) }).strict();
var assistanceModerateSchema = external_exports.object({ action: external_exports.literal("moderate"), ...common3, digest: hash3, state: external_exports.enum(["HIDDEN", "VISIBLE"]), reason: external_exports.enum(moderationReasons) }).strict().refine((value) => value.state === "VISIBLE" === (value.reason === "RESTORED"));
var assistanceReportSchema = external_exports.object({ action: external_exports.literal("report"), ...common3, digest: hash3, reason: external_exports.enum(reportReasons), details: text4(1500) }).strict();
var researchDomain = external_exports.enum(["RESEARCH", "VENTURE"]);
var objectiveId = text4(48).refine((value) => /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value));
var sourceIndices = external_exports.array(external_exports.number().int().min(0).max(7)).max(8).refine((value) => new Set(value).size === value.length);
function pointerSegments(value) {
  if (!value.startsWith("/") || value.length > 256 || /(?:~(?![01]))/.test(value)) return null;
  const segments = value.slice(1).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  if (segments.some((part) => !part || ["__proto__", "prototype", "constructor"].includes(part))) return null;
  return segments;
}
var claimPath = text4(256).refine((value) => pointerSegments(value) !== null).nullable();
var assistanceObjectiveSchema = external_exports.object({ id: objectiveId, prompt: text4(1e3), claimPath, sourceIndices }).strict();
var assistanceAnswerSchema = external_exports.object({ objectiveId, stance: external_exports.enum(["SUPPORTS", "CONTRADICTS", "UNKNOWN"]), explanation: text4(1500), sourceIndices }).strict();
var objectives = external_exports.array(assistanceObjectiveSchema).min(1).max(5).refine((value) => new Set(value.map((objective) => objective.id)).size === value.length);
var answers = external_exports.array(assistanceAnswerSchema).min(1).max(5).refine((value) => new Set(value.map((answer) => answer.objectiveId)).size === value.length);
var assistanceRequestV2Schema = external_exports.object({ version: external_exports.literal(2), action: external_exports.literal("request"), requestId: uuid3, id: uuid3, domain: researchDomain, base: assistanceReferenceSchema, intent: text4(2e3), constraints: text4(1e3), falsification: text4(1e3), objectives, policyAccepted: policy3 }).strict().refine((value) => value.id !== value.base.id);
var assistanceRespondV2Schema = external_exports.object({ version: external_exports.literal(2), action: external_exports.literal("respond"), requestId: uuid3, id: uuid3, domain: researchDomain, request: assistanceReferenceSchema, proposal: assistanceReferenceSchema, rationale: text4(1500), questions: text4(1e3, 0), answers, policyAccepted: policy3 }).strict().refine((value) => value.id !== value.request.id && value.id !== value.proposal.id && value.proposal.id !== value.request.id);
var assistanceCommandSchema = external_exports.union([assistanceRequestSchema, assistanceRespondSchema, assistanceWithdrawSchema, assistanceModerateSchema, assistanceReportSchema, assistanceRequestV2Schema, assistanceRespondV2Schema]);
var recordHead = { version: external_exports.literal(1), id: uuid3, requestId: uuid3, createdAt: clock3, author: fullAuthor };
var recordTail = { policyAccepted: policy3, executionEnabled: external_exports.literal(false) };
var assistanceRequestRecordSchema = external_exports.object({ version: recordHead.version, kind: external_exports.literal("REQUEST"), id: uuid3, requestId: uuid3, createdAt: clock3, author: fullAuthor, base: assistanceReferenceSchema, intent: text4(2e3), constraints: text4(1e3), falsification: text4(1e3), ...recordTail }).strict().refine((value) => value.author.kind === "HUMAN" && value.author.id === value.author.sponsorId);
var assistanceResponseRecordSchema = external_exports.object({ version: recordHead.version, kind: external_exports.literal("RESPONSE"), id: uuid3, requestId: uuid3, createdAt: clock3, author: fullAuthor, request: assistanceReferenceSchema, proposal: assistanceReferenceSchema, rationale: text4(1500), questions: text4(1e3, 0), ...recordTail }).strict().refine((value) => value.author.kind === "AGENT" && value.id !== value.request.id);
var assistanceResearchRequestRecordSchema = external_exports.object({ version: external_exports.literal(2), kind: external_exports.literal("REQUEST"), id: uuid3, requestId: uuid3, createdAt: clock3, author: fullAuthor, domain: researchDomain, base: assistanceReferenceSchema, intent: text4(2e3), constraints: text4(1e3), falsification: text4(1e3), objectives, ...recordTail }).strict().refine((value) => value.author.kind === "HUMAN" && value.author.id === value.author.sponsorId && value.id !== value.base.id);
var assistanceResearchResponseRecordSchema = external_exports.object({ version: external_exports.literal(2), kind: external_exports.literal("RESPONSE"), id: uuid3, requestId: uuid3, createdAt: clock3, author: fullAuthor, domain: researchDomain, request: assistanceReferenceSchema, proposal: assistanceReferenceSchema, rationale: text4(1500), questions: text4(1e3, 0), answers, ...recordTail }).strict().refine((value) => value.author.kind === "AGENT" && value.id !== value.request.id && value.id !== value.proposal.id && value.proposal.id !== value.request.id);
var assistanceRecordV1Schema = external_exports.union([assistanceRequestRecordSchema, assistanceResponseRecordSchema]);
var assistanceRecordV2Schema = external_exports.union([assistanceResearchRequestRecordSchema, assistanceResearchResponseRecordSchema]);
var assistanceRecordSchema = external_exports.union([assistanceRecordV1Schema, assistanceRecordV2Schema]);
function assistanceRecordDomain(record) {
  return record.version === 2 ? record.domain : "STRATEGY";
}
var state3 = external_exports.enum(["VISIBLE", "HIDDEN", "WITHDRAWN"]);
var reason = external_exports.enum([...withdrawReasons, ...moderationReasons]);
var assistanceModerationEventSchema = external_exports.object({ sequence: external_exports.number().int().min(1).max(16), requestId: uuid3, createdAt: clock3, actor: authorReference, state: state3, reason }).strict();
var publicItemFields = { id: uuid3, kind: external_exports.enum(["REQUEST", "RESPONSE"]), digest: hash3, requestId: uuid3, createdAt: clock3, author: authorReference, state: state3, reason: reason.nullable(), availability: external_exports.enum(["AVAILABLE", "SUPPRESSED", "DEPENDENCY_UNAVAILABLE"]), record: assistanceRecordV1Schema.nullable(), moderation: external_exports.array(assistanceModerationEventSchema).max(16) };
function refinePublicItem(value, ctx) {
  const bad = () => ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Assistance metadata and lifecycle must agree." });
  if (value.record && assistanceRecordDomain(value.record) !== (value.domain ?? "STRATEGY")) bad();
  if (value.kind === "REQUEST" ? value.author.kind !== "HUMAN" : value.author.kind !== "AGENT") bad();
  if (value.availability === "AVAILABLE" ? value.state !== "VISIBLE" || value.record === null : value.record !== null || value.availability === "SUPPRESSED" && value.state === "VISIBLE" || value.availability === "DEPENDENCY_UNAVAILABLE" && value.state !== "VISIBLE") bad();
  if (value.record && (value.record.id !== value.id || value.record.kind !== value.kind || value.record.requestId !== value.requestId || value.record.createdAt !== value.createdAt || JSON.stringify(researchAuthorReference(value.record.author)) !== JSON.stringify(value.author))) bad();
  let current = "VISIBLE", why = null, at = value.createdAt;
  const requests = /* @__PURE__ */ new Set([value.author.kind + ":" + value.author.id + ":" + value.requestId]);
  for (let n = 0; n < value.moderation.length; n++) {
    const event = value.moderation[n], key = event.actor.kind + ":" + event.actor.id + ":" + event.requestId;
    if (event.sequence !== n + 1 || event.createdAt < at || current === "WITHDRAWN" || requests.has(key)) bad();
    if (event.state === "WITHDRAWN") {
      const own = event.actor.kind === value.author.kind && event.actor.id === value.author.id, sponsor = event.actor.kind === "HUMAN" && event.actor.id === value.author.sponsorId;
      if (!withdrawReasons.includes(event.reason) || !own && !sponsor || event.reason === "AUTHOR_REQUEST" && !own || event.reason === "SPONSOR_REQUEST" && !sponsor) bad();
    } else if (event.actor.kind !== "HUMAN" || event.sequence >= 16 || event.state === "VISIBLE" !== (event.reason === "RESTORED") || !moderationReasons.includes(event.reason)) bad();
    current = event.state;
    why = event.reason;
    at = event.createdAt;
    requests.add(key);
  }
  if (current !== value.state || why !== value.reason) bad();
}
var assistancePublicItemV1Schema = external_exports.object(publicItemFields).strict().superRefine(refinePublicItem);
var assistancePublicItemV2Schema = external_exports.object({ ...publicItemFields, record: assistanceRecordV2Schema.nullable(), domain: researchDomain }).strict().superRefine(refinePublicItem);
var assistancePublicItemSchema = external_exports.union([assistancePublicItemV1Schema, assistancePublicItemV2Schema]);
function assistancePublicItemDomain(item) {
  return "domain" in item ? item.domain : "STRATEGY";
}
var envelope = { version: external_exports.literal(1), executionEnabled: external_exports.literal(false) };
var listFields = { version: envelope.version, items: external_exports.array(assistancePublicItemV1Schema).max(12), request: assistanceReferenceSchema.nullable(), nextCursor: uuid3.nullable(), executionEnabled: envelope.executionEnabled };
function refineList(value, ctx) {
  if (value.items.some((item) => assistancePublicItemDomain(item) !== (value.domain ?? "STRATEGY"))) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Assistance page domain must agree." });
  if (value.items.some((item) => value.request ? item.kind !== "RESPONSE" || item.record?.kind === "RESPONSE" && (item.record.request.id !== value.request.id || item.record.request.digest !== value.request.digest) : item.kind !== "REQUEST") || new Set(value.items.map((item) => item.id)).size !== value.items.length || value.items.some((item, n) => n && (item.createdAt > value.items[n - 1].createdAt || item.createdAt === value.items[n - 1].createdAt && item.id >= value.items[n - 1].id)) || value.nextCursor !== null && (value.items.length !== 12 || value.nextCursor !== value.items.at(-1)?.id)) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Assistance page identities/order/cursor must agree." });
}
var assistanceListV1Schema = external_exports.object(listFields).strict().superRefine(refineList);
var assistanceResearchListSchema = external_exports.object({ ...listFields, items: external_exports.array(assistancePublicItemV2Schema).max(12), domain: researchDomain }).strict().superRefine(refineList);
var assistanceListSchema = external_exports.union([assistanceListV1Schema, assistanceResearchListSchema]);
var assistanceGetSchema = external_exports.object({ version: envelope.version, item: assistancePublicItemSchema, executionEnabled: envelope.executionEnabled }).strict();
var assistancePrivateReportSchema = external_exports.object({ requestId: uuid3, id: uuid3, digest: hash3, reason: external_exports.enum(reportReasons), details: text4(1500), createdAt: clock3, reporter: authorReference }).strict();
var assistanceReportReceiptSchema = assistancePrivateReportSchema.omit({ details: true, reporter: true });
var assistanceWriteSchema = external_exports.object({ version: envelope.version, action: external_exports.enum(["request", "respond", "withdraw", "moderate", "report"]), requestId: uuid3, item: assistancePublicItemSchema.nullable(), report: assistanceReportReceiptSchema.nullable(), executionEnabled: envelope.executionEnabled }).strict().refine((value) => value.action === "report" ? value.item === null && value.report !== null && value.report.requestId === value.requestId : value.item !== null && value.report === null);
var assistanceReportsSchema = external_exports.object({ version: envelope.version, reports: external_exports.array(assistancePrivateReportSchema).max(12), nextCursor: hash3.nullable(), executionEnabled: envelope.executionEnabled }).strict().superRefine((value, ctx) => {
  const keys = value.reports.map((report) => report.reporter.kind + ":" + report.reporter.id + ":" + report.requestId);
  if (new Set(keys).size !== keys.length || value.reports.some((report, n) => n && (report.createdAt > value.reports[n - 1].createdAt || report.createdAt === value.reports[n - 1].createdAt && (report.reporter.kind + ":" + report.reporter.id > value.reports[n - 1].reporter.kind + ":" + value.reports[n - 1].reporter.id || report.reporter.kind === value.reports[n - 1].reporter.kind && report.reporter.id === value.reports[n - 1].reporter.id && report.requestId >= value.reports[n - 1].requestId))) || value.nextCursor !== null && value.reports.length !== 12) ctx.addIssue({ code: external_exports.ZodIssueCode.custom, message: "Private report page identities/order/cursor must agree." });
});
function plain(raw) {
  let count = 0;
  const path = /* @__PURE__ */ new Set();
  function walk(value, depth) {
    if (++count > assistanceLimits.maximumNodes || depth > assistanceLimits.maximumDepth) throw new AssistanceError("Assistance structure exceeds its bound.", 400);
    if (typeof value === "string") {
      if (credential(value)) throw new AssistanceError("Credentials cannot enter assistance material.", 400);
      return;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return;
    if (!value || typeof value !== "object" || path.has(value) || Object.getOwnPropertySymbols(value).length) throw new AssistanceError("Assistance must be plain finite JSON.", 400);
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), descriptors = Object.getOwnPropertyDescriptors(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new AssistanceError("Assistance must be plain JSON.", 400);
    if (array && Object.keys(descriptors).length !== value.length + 1) throw new AssistanceError("Assistance arrays must be complete.", 400);
    path.add(value);
    for (const [key, entry] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (credential(key) || !("value" in entry) || !entry.enumerable || array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) throw new AssistanceError("Assistance must be plain JSON.", 400);
      walk(entry.value, depth + 1);
    }
    path.delete(value);
  }
  walk(raw, 0);
}
function bounded(raw, schema, maximum) {
  plain(raw);
  if (new TextEncoder().encode(JSON.stringify(raw)).byteLength > maximum) throw new AssistanceError("Assistance material exceeds its byte bound.", 413);
  let record;
  try {
    record = schema.parse(raw);
  } catch {
    throw new AssistanceError("Invalid assistance material.", 400);
  }
  const payload = JSON.stringify(record);
  if (new TextEncoder().encode(payload).byteLength > maximum) throw new AssistanceError("Assistance material exceeds its byte bound.", 413);
  return { record, payload };
}
function boundedAssistanceCommand(raw) {
  const { record: command, payload } = bounded(raw, assistanceCommandSchema, assistanceLimits.requestBytes);
  return { command, payload };
}
function boundedAssistanceRecord(raw) {
  return bounded(raw, assistanceRecordSchema, assistanceLimits.recordBytes);
}
function assistanceRecordForCommand(command, author, createdAt) {
  if (command.action === "request") return boundedAssistanceRecord("version" in command ? { version: 2, kind: "REQUEST", id: command.id, requestId: command.requestId, createdAt, author, domain: command.domain, base: command.base, intent: command.intent, constraints: command.constraints, falsification: command.falsification, objectives: command.objectives, policyAccepted: command.policyAccepted, executionEnabled: false } : { version: 1, kind: "REQUEST", id: command.id, requestId: command.requestId, createdAt, author, base: command.base, intent: command.intent, constraints: command.constraints, falsification: command.falsification, policyAccepted: command.policyAccepted, executionEnabled: false }).record;
  if (command.action === "respond") return boundedAssistanceRecord("version" in command ? { version: 2, kind: "RESPONSE", id: command.id, requestId: command.requestId, createdAt, author, domain: command.domain, request: command.request, proposal: command.proposal, rationale: command.rationale, questions: command.questions, answers: command.answers, policyAccepted: command.policyAccepted, executionEnabled: false } : { version: 1, kind: "RESPONSE", id: command.id, requestId: command.requestId, createdAt, author, request: command.request, proposal: command.proposal, rationale: command.rationale, questions: command.questions, policyAccepted: command.policyAccepted, executionEnabled: false }).record;
  throw new AssistanceError("This command creates no publication.", 400);
}
function assistanceCommandForRecord(raw) {
  const record = boundedAssistanceRecord(raw).record;
  if (record.kind === "REQUEST") return boundedAssistanceCommand(record.version === 2 ? { version: 2, action: "request", requestId: record.requestId, id: record.id, domain: record.domain, base: record.base, intent: record.intent, constraints: record.constraints, falsification: record.falsification, objectives: record.objectives, policyAccepted: record.policyAccepted } : { action: "request", requestId: record.requestId, id: record.id, base: record.base, intent: record.intent, constraints: record.constraints, falsification: record.falsification, policyAccepted: record.policyAccepted }).command;
  return boundedAssistanceCommand(record.version === 2 ? { version: 2, action: "respond", requestId: record.requestId, id: record.id, domain: record.domain, request: record.request, proposal: record.proposal, rationale: record.rationale, questions: record.questions, answers: record.answers, policyAccepted: record.policyAccepted } : { action: "respond", requestId: record.requestId, id: record.id, request: record.request, proposal: record.proposal, rationale: record.rationale, questions: record.questions, policyAccepted: record.policyAccepted }).command;
}
function checkedResearch(raw) {
  plain(raw);
  try {
    return researchRecordSchema.parse(raw);
  } catch {
    throw new AssistanceError("Invalid research dependency.", 400);
  }
}
function researchDomainFor(record) {
  return record.version === 2 ? "VENTURE" : "RESEARCH";
}
function hasExactContentPath(content, pointer) {
  const segments = pointerSegments(pointer);
  if (!segments) return false;
  let value = content;
  for (const segment of segments) {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value) && (!/^(0|[1-9][0-9]*)$/.test(segment) || Number(segment) >= value.length)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, segment);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return false;
    value = descriptor.value;
  }
  return true;
}
function validateResearchAssistanceRequest(raw, baseResearchRecord) {
  const record = boundedAssistanceRecord(raw).record, base = checkedResearch(baseResearchRecord);
  if (record.version !== 2 || record.kind !== "REQUEST" || record.domain !== researchDomainFor(base) || record.base.id !== base.id || record.createdAt < base.createdAt || record.objectives.some((objective) => objective.claimPath !== null && !hasExactContentPath(base.content, objective.claimPath) || objective.sourceIndices.some((index) => index >= base.content.sources.length))) throw new AssistanceError("Research request domain, exact base, objective path or source indices do not match.", 400);
  return record;
}
function validateResearchAssistanceResponse(raw, rawRequest, proposalResearchRecord) {
  const response = boundedAssistanceRecord(raw).record, request = boundedAssistanceRecord(rawRequest).record, proposal = checkedResearch(proposalResearchRecord);
  if (response.version !== 2 || response.kind !== "RESPONSE" || request.version !== 2 || request.kind !== "REQUEST") throw new AssistanceError("Research assistance artifacts are required.", 400);
  const relation = proposal.content.relation, objectiveIds = new Set(request.objectives.map((objective) => objective.id));
  if (response.domain !== request.domain || response.domain !== researchDomainFor(proposal) || response.request.id !== request.id || response.proposal.id !== proposal.id || response.createdAt < request.createdAt || proposal.createdAt < request.createdAt || response.createdAt < proposal.createdAt || proposal.author.kind !== "AGENT" || JSON.stringify(researchAuthorReference(proposal.author)) !== JSON.stringify(researchAuthorReference(response.author)) || !relation || !["FORK", "CHALLENGE"].includes(relation.type) || relation.id !== request.base.id || relation.digest !== request.base.digest || response.answers.length !== objectiveIds.size || response.answers.some((answer) => !objectiveIds.has(answer.objectiveId) || answer.sourceIndices.some((index) => index >= proposal.content.sources.length))) throw new AssistanceError("Research response domain, exact references, author, proposal relation, objectives or source indices do not match.", 400);
  return response;
}
async function validateAssistancePublicItem(raw) {
  plain(raw);
  const item = assistancePublicItemSchema.parse(raw);
  if (item.record && await researchDigest(boundedAssistanceRecord(item.record).payload) !== item.digest) throw new AssistanceError("Assistance content digest does not match.", 400);
  return item;
}
async function validateAssistanceWrite(raw, rawCommand, rawAuthor) {
  plain(raw);
  plain(rawAuthor);
  const receipt = assistanceWriteSchema.parse(raw), command = boundedAssistanceCommand(rawCommand).command, frozen = external_exports.union([fullAuthor, authorReference]).parse(rawAuthor), author = authorReference.parse({ kind: frozen.kind, id: frozen.id, sponsorId: frozen.sponsorId }), fail2 = () => {
    throw new AssistanceError("Assistance receipt does not match the original command.", 400);
  };
  if (receipt.action !== command.action || receipt.requestId !== command.requestId) fail2();
  if (command.action === "report") {
    if (!receipt.report || receipt.report.id !== command.id || receipt.report.digest !== command.digest || receipt.report.reason !== command.reason) fail2();
    return receipt;
  }
  const item = await validateAssistancePublicItem(receipt.item);
  if (item.id !== command.id) fail2();
  if ((command.action === "request" || command.action === "respond") && assistancePublicItemDomain(item) !== ("version" in command ? command.domain : "STRATEGY")) fail2();
  if (command.action === "request" || command.action === "respond") {
    if (item.requestId !== command.requestId || JSON.stringify(item.author) !== JSON.stringify(author) || command.action === "request" !== (item.kind === "REQUEST")) fail2();
    const suppliedFull = frozen.kind === "HUMAN" || "name" in frozen ? frozen : null;
    if (item.record && suppliedFull && JSON.stringify(item.record.author) !== JSON.stringify(suppliedFull)) fail2();
    const fullAuthor2 = suppliedFull ?? item.record?.author;
    if (!fullAuthor2) fail2();
    if (item.record && JSON.stringify(assistanceCommandForRecord(item.record)) !== JSON.stringify(command)) fail2();
    if (fullAuthor2 && await researchDigest(boundedAssistanceRecord(assistanceRecordForCommand(command, fullAuthor2, item.createdAt)).payload) !== item.digest) fail2();
  } else {
    if (item.digest !== command.digest) fail2();
    const event = item.moderation.find((entry) => entry.requestId === command.requestId && JSON.stringify(entry.actor) === JSON.stringify(author));
    if (!event || event.state !== (command.action === "withdraw" ? "WITHDRAWN" : command.state) || event.reason !== command.reason) fail2();
  }
  return receipt;
}

// app/assistance-handoff.ts
var assistanceHandoffLimits = { queryBytes: 512, sourceBytes: 65536, bundleBytes: 262144, maximumChanges: 128 };
var id = external_exports.string().length(36).regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
var digest = external_exports.string().length(64).regex(/^[a-f0-9]{64}$/);
var referenceSchema = external_exports.object({ id, digest }).strict();
var AssistanceHandoffError = class extends Error {
  constructor(message) {
    super(message);
  }
};
var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
var bytes = (value) => new TextEncoder().encode(value).byteLength;
function plain2(raw, maximum) {
  let count = 0;
  const ancestors = /* @__PURE__ */ new Set();
  function inspect(value, depth) {
    if (++count > 16384 || depth > 16) throw new AssistanceHandoffError("Assistance input exceeds structural bounds.");
    if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return;
    if (typeof value !== "object" || Object.getOwnPropertySymbols(value).length || ancestors.has(value)) throw new AssistanceHandoffError("Only plain finite JSON is accepted.");
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new AssistanceHandoffError("Only plain JSON containers are accepted.");
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (array) {
      const keys = Object.keys(descriptors).filter((key) => key !== "length");
      if (keys.length !== value.length || keys.some((key, n) => key !== String(n))) throw new AssistanceHandoffError("Only complete ordinary arrays are accepted.");
    }
    ancestors.add(value);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (!("value" in descriptor) || !descriptor.enumerable) throw new AssistanceHandoffError("Input hooks and hidden fields are refused.");
      inspect(descriptor.value, depth + 1);
    }
    ancestors.delete(value);
  }
  inspect(raw, 0);
  if (bytes(JSON.stringify(raw)) > maximum) throw new AssistanceHandoffError("Assistance input exceeds its byte budget.");
}
function reference(raw) {
  plain2(raw, 256);
  try {
    return referenceSchema.parse(raw);
  } catch {
    throw new AssistanceHandoffError("An exact canonical ID and digest are required.");
  }
}
function noCredentials(raw, inAuthor = false) {
  if (typeof raw === "string") {
    let value = raw;
    for (let n = 0; n < 32; n++) {
      if (/og_local_(?:producer|owner)_/i.test(value) || !inAuthor && /og_agent_/i.test(value)) throw new AssistanceHandoffError("Credentials cannot enter assistance.");
      const next = value.replace(/%[a-f0-9]{2}/gi, (escape) => String.fromCharCode(Number.parseInt(escape.slice(1), 16)));
      if (next === value) return;
      value = next;
    }
    throw new AssistanceHandoffError("Assistance text exceeds encoded inspection bounds.");
  } else if (raw && typeof raw === "object") for (const [key, value] of Object.entries(raw)) noCredentials(value, inAuthor || key === "author");
}
async function verifyAssistanceStrategy(raw, expected, visible2 = false) {
  plain2(raw, assistanceHandoffLimits.sourceBytes);
  noCredentials(raw);
  const item = strategyPublicItemSchema.parse(raw);
  reference({ id: item.id, digest: item.digest });
  id.parse(item.rootId);
  id.parse(item.requestId);
  if (item.author.kind === "AGENT") id.parse(item.author.id);
  if (expected && !same(reference(expected), { id: item.id, digest: item.digest })) throw new AssistanceHandoffError("The exact strategy changed.");
  if (item.record) {
    await verifyStrategyProgram(item.record);
    if (await researchDigest(boundedStrategyRecord(item.record).payload) !== item.digest) throw new AssistanceHandoffError("The strategy digest does not match its content.");
    if (item.record.content.relation) reference({ id: item.record.content.relation.id, digest: item.record.content.relation.digest });
  }
  if (visible2 && (item.state !== "VISIBLE" || !item.record)) throw new AssistanceHandoffError("The exact strategy is unavailable.");
  return item;
}
async function verifyAssistanceItem(raw, expected, kind2, visible2 = false) {
  plain2(raw, assistanceHandoffLimits.sourceBytes);
  noCredentials(raw);
  const item = assistancePublicItemSchema.parse(raw);
  if ("domain" in item) throw new AssistanceHandoffError("Research assistance requires its separate exact research workflow.");
  reference({ id: item.id, digest: item.digest });
  if (expected && !same(reference(expected), { id: item.id, digest: item.digest }) || kind2 && item.kind !== kind2) throw new AssistanceHandoffError("The exact assistance reference changed.");
  if (item.record && await researchDigest(boundedAssistanceRecord(item.record).payload) !== item.digest) throw new AssistanceHandoffError("The assistance digest does not match its content.");
  if (visible2 && (item.state !== "VISIBLE" || item.availability !== "AVAILABLE" || !item.record)) throw new AssistanceHandoffError("This assistance record or dependency is unavailable.");
  return item;
}
async function validateAssistanceHandoff(raw) {
  plain2(raw, assistanceHandoffLimits.bundleBytes);
  const shape = external_exports.object({ base: strategyPublicItemSchema, request: assistancePublicItemSchema, response: assistancePublicItemSchema, proposal: strategyPublicItemSchema }).strict().parse(raw);
  const request = await verifyAssistanceItem(shape.request, void 0, "REQUEST", true), response = await verifyAssistanceItem(shape.response, void 0, "RESPONSE", true);
  if (request.record?.kind !== "REQUEST" || response.record?.kind !== "RESPONSE") throw new AssistanceHandoffError("A complete exact request and response are required.");
  const base = await verifyAssistanceStrategy(shape.base, request.record.base, true), proposal = await verifyAssistanceStrategy(shape.proposal, response.record.proposal, true);
  if (request.createdAt < base.createdAt || !same(response.record.request, { id: request.id, digest: request.digest }) || response.author.kind !== "AGENT" || proposal.author.kind !== "AGENT" || !same(response.record.author, proposal.record?.author) || proposal.revision !== 1 || proposal.rootId !== proposal.id || !same(proposal.record?.content.relation, { type: "FORK", ...request.record.base }) || proposal.createdAt < request.createdAt || response.createdAt < proposal.createdAt || response.createdAt < request.createdAt) throw new AssistanceHandoffError("The response must link its own later agent fork of this exact base.");
  return { base, request, response, proposal };
}

// app/research-assistance-client.ts
var researchAssistanceClientLimits = { sourceBytes: 65536, listBytes: 524288, heldBytes: 1048576, responses: 32 };
var same2 = (a, b) => JSON.stringify(a) === JSON.stringify(b);
var reference2 = (item) => ({ id: item.id, digest: item.digest });
function bounded2(raw, maximum = researchAssistanceClientLimits.heldBytes) {
  let count = 0;
  const ancestors = /* @__PURE__ */ new Set();
  function visit(value, depth) {
    if (++count > 32768 || depth > 16) throw Error("Input exceeds structural bounds.");
    if (typeof value === "string") {
      let text5 = value;
      for (let n = 0; n < 32; n++) {
        if (/og_(?:agent|local_(?:producer|owner))_/i.test(text5)) throw Error("Credentials cannot enter research assistance.");
        const next = text5.replace(/%[a-f0-9]{2}/gi, (escape) => String.fromCharCode(Number.parseInt(escape.slice(1), 16)));
        if (next === text5) return;
        text5 = next;
      }
      throw Error("Encoded input exceeds inspection bounds.");
    }
    if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return;
    if (!value || typeof value !== "object" || ancestors.has(value) || Object.getOwnPropertySymbols(value).length) throw Error("Plain finite JSON required.");
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw Error("Plain JSON required.");
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (array && (Object.keys(descriptors).filter((key) => key !== "length").length !== value.length || Object.keys(descriptors).filter((key) => key !== "length").some((key, n) => key !== String(n)))) throw Error("Ordinary complete arrays required.");
    ancestors.add(value);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (!("value" in descriptor) || !descriptor.enumerable) throw Error("Input hooks refused.");
      visit(descriptor.value, depth + 1);
    }
    ancestors.delete(value);
  }
  visit(raw, 0);
  if (new TextEncoder().encode(JSON.stringify(raw)).byteLength > maximum) throw Error("Input exceeds byte budget.");
}
function researchAssistanceDomain(item) {
  if (!item.record) throw Error("Research domain unavailable.");
  return item.record.version === 2 ? "VENTURE" : "RESEARCH";
}
async function verifyResearchAssistanceSource(raw, expected, domain) {
  bounded2(raw, researchAssistanceClientLimits.sourceBytes);
  const item = researchPublicItemSchema.parse(raw);
  if (expected && !same2(reference2(item), expected)) throw Error("Exact research reference changed.");
  if (item.record) {
    if (await researchDigest(boundedResearchRecord(item.record).payload) !== item.digest) throw Error("Research content digest mismatch.");
    if (domain && researchAssistanceDomain(item) !== domain) throw Error("Research domain mismatch.");
  }
  return item;
}
async function verifyResearchAssistanceRecord(raw, domain, expected) {
  bounded2(raw, researchAssistanceClientLimits.sourceBytes);
  const item = assistancePublicItemSchema.parse(raw);
  if (assistancePublicItemDomain(item) !== domain || expected && !same2(reference2(item), expected)) throw Error("Exact assistance domain or reference changed.");
  if (item.record && await researchDigest(boundedAssistanceRecord(item.record).payload) !== item.digest) throw Error("Assistance content digest mismatch.");
  return item;
}
function visible(item) {
  if (item.state !== "VISIBLE" || !item.record || "availability" in item && item.availability !== "AVAILABLE") throw Error("Exact publication unavailable.");
}
async function validateResearchAssistanceBundle(raw, domain) {
  bounded2(raw);
  const base = await verifyResearchAssistanceSource(raw.base, void 0, domain), request = await verifyResearchAssistanceRecord(raw.request, domain), response = await verifyResearchAssistanceRecord(raw.response, domain), proposal = await verifyResearchAssistanceSource(raw.proposal, void 0, domain);
  for (const item of [base, request, response, proposal]) visible(item);
  if (request.record?.version !== 2 || request.record.kind !== "REQUEST" || response.record?.version !== 2 || response.record.kind !== "RESPONSE" || !base.record || !proposal.record || response.author.kind !== "AGENT" || proposal.author.kind !== "AGENT" || !same2(response.author, proposal.author) || !same2(request.record.base, reference2(base)) || !same2(response.record.request, reference2(request)) || !same2(response.record.proposal, reference2(proposal)) || request.createdAt < base.createdAt || proposal.createdAt < request.createdAt || response.createdAt < proposal.createdAt) throw Error("Exact agent proposal chain mismatch.");
  validateResearchAssistanceRequest(request.record, base.record);
  validateResearchAssistanceResponse(response.record, request.record, proposal.record);
  return { base, request, response, proposal };
}
export {
  assistancePublicItemDomain,
  assistanceRecordForCommand,
  boundedAssistanceCommand,
  boundedAssistanceRecord,
  researchDigest as strategyDigest,
  validateAssistanceHandoff,
  validateAssistanceWrite,
  validateResearchAssistanceBundle,
  verifyAssistanceItem,
  verifyAssistanceStrategy,
  verifyResearchAssistanceRecord,
  verifyResearchAssistanceSource
};
