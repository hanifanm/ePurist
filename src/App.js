import React, { useContext, useState } from "react";
import CouchDBWrapper from "./couchdb";
import { DATA_TYPES, doAnalyze, TYPE_KEY } from "./analyzer";

const FETCH_STATUS = {
  PENDING: "PENDING",
  LOADING: "LOADING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
};

const DATA_TYPES_NULL_OR_UNDEFINED = DATA_TYPES.filter(
  ({ key }) => key === TYPE_KEY.NULL || key === TYPE_KEY.UNDEFINED
);
const DATA_TYPES_NON_NULL_NON_UNDEFINED = DATA_TYPES.filter(
  ({ key }) => key !== TYPE_KEY.NULL && key !== TYPE_KEY.UNDEFINED
);

async function fetchData(dbName, dbUrl, batchLength, updateData) {
  const db = new CouchDBWrapper(dbName, dbUrl);
  let allData = [];
  let tmpData = [];
  let skip = 0;
  do {
    const res = await db.find({
      selector: {},
      limit: batchLength,
      skip,
    });
    tmpData = res.rows;
    skip += batchLength;
    // eslint-disable-next-line no-loop-func
    allData = [...allData, ...tmpData];
    updateData(allData);
  } while (tmpData.length === batchLength);
  return allData;
}

function useInput(initialValue) {
  const [value, setValue] = useState(initialValue);
  return {
    value,
    onChange: (e) => {
      setValue(e.target.value);
    },
  };
}

function useAnalyzer() {
  const [status, setStatus] = useState(FETCH_STATUS.PENDING);
  const [lastError, setLastError] = useState(null);
  const [data, setData] = useState([]);
  const [analysisResult, setAnalysisResult] = useState([]);

  async function analyze({ dbUrl, dbName, batchLength }) {
    setStatus(FETCH_STATUS.LOADING);
    try {
      const newData = await fetchData(dbName, dbUrl, batchLength, setData);
      const newAnalysis = await doAnalyze(newData);
      setData(newData);
      setAnalysisResult(newAnalysis);
      setStatus(FETCH_STATUS.SUCCESS);
    } catch (err) {
      setStatus(FETCH_STATUS.FAILED);
      setLastError(err);
      console.error(err);
    }
  }

  return {
    data,
    analysisResult,
    status,
    lastError,
    analyze,
  };
}

const AnalyzerContext = React.createContext();

function useAnalyzerContext() {
  const analyzer = useContext(AnalyzerContext);
  return analyzer;
}

function AnalyzerProvider({ children }) {
  const analyzer = useAnalyzer();
  return (
    <AnalyzerContext.Provider value={analyzer}>
      {children}
    </AnalyzerContext.Provider>
  );
}

function Input({ id, label, ...inputProps }) {
  return (
    <div className="form-group mb-3">
      <label htmlFor={id}>{label}</label>
      <input className="form-control" id={id} {...inputProps} />
    </div>
  );
}

function Button({ label, classType = "primary", onClick, ...buttonProps }) {
  function handleClick(e) {
    e.preventDefault();
    onClick(e);
  }
  return (
    <button
      onClick={handleClick}
      className={`btn btn-${classType}`}
      {...buttonProps}
    >
      {label}
    </button>
  );
}

function Form() {
  const { analyze, status } = useAnalyzerContext();
  const dbUrl = useInput("");
  const dbName = useInput("");
  const batchLength = useInput(1000);
  function handleAnalyze() {
    analyze({
      dbUrl: dbUrl.value.trim(),
      dbName: dbName.value.trim(),
      batchLength: Number(batchLength.value),
    });
  }
  function isValid() {
    return (
      dbUrl.value &&
      dbName.value &&
      Number(batchLength.value) > 0 &&
      Number(batchLength.value) <= 1000
    );
  }
  return (
    <div className="mb-5">
      <form>
        <h3 className="mb-4">Please insert your couchdb credentials</h3>
        <Input
          id="host"
          label="Database URL & Credential"
          placeholder="https://<usernmae>:<password>@<host>:<port>"
          {...dbUrl}
        />
        <Input
          id="db-name"
          label="Database Name"
          {...dbName}
          placeholder="i.e fligth_schedules"
        />
        <Input
          id="batch-length"
          label="Request Batch Length"
          placeholder="1000"
          type="number"
          min="0"
          max="1000"
          {...batchLength}
        />
        <Button
          type="submit"
          label="Analyze"
          onClick={handleAnalyze}
          disabled={status === FETCH_STATUS.LOADING || !isValid()}
        />
      </form>
      <hr />
    </div>
  );
}

function AnalysisReportLoading({ dataLength }) {
  return (
    <div className="d-flex justify-content-center align-items-center">
      <div className="py-5 d-flex flex-column justify-content-center align-items-center">
        <div
          className="spinner-grow text-primary mb-3"
          role="status"
          style={{ width: 50, height: 50 }}
        ></div>
        <span className="mb-1 badge bg-primary fs-6 text px-3">
          Doing Science ...
        </span>
        <span>{dataLength} row[s] retrieved</span>
      </div>
    </div>
  );
}

function AnalysisReportRow({ variableName, data, level = 0 }) {
  const dataTypeKeys = DATA_TYPES.map(({ key }) => key);
  const dataTypeKeysNonNullNonUndefined = DATA_TYPES_NON_NULL_NON_UNDEFINED.map(
    ({ key }) => key
  );
  const otherKeys = Object.keys(data)
    .filter((key) => dataTypeKeys.indexOf(key) < 0)
    .sort();

  const spaces = [...Array(level)].map((_, index) => (
    <span key={index}>{"  "}</span>
  ));

  // Check if data has multiple types other than null and undefined
  const isMultitype =
    dataTypeKeysNonNullNonUndefined.reduce(
      (sum, key) => (!data[key] ? sum : sum + 1),
      0
    ) > 1;

  const isHasNullOrUndefined =
    data[TYPE_KEY.NULL] > 0 || data[TYPE_KEY.UNDEFINED] > 0;

  const rowStyle = isMultitype
    ? "table-danger"
    : isHasNullOrUndefined
    ? "table-warning"
    : "";

  const rowNote = isMultitype
    ? "Has several datatypes"
    : isHasNullOrUndefined
    ? "Contains null or undefined"
    : "";

  return (
    <>
      <tr className={rowStyle}>
        <td>
          {spaces}
          <span>{variableName}</span>
        </td>
        {DATA_TYPES_NULL_OR_UNDEFINED.map((dataType, index) => (
          <td
            key={dataType.key}
            className="text-center"
            style={{ borderLeft: index === 0 ? "2px solid black" : 0 }}
          >
            {data[dataType.key] || 0}
          </td>
        ))}
        {DATA_TYPES_NON_NULL_NON_UNDEFINED.map((dataType, index) => (
          <td
            key={dataType.key}
            className="text-center"
            style={{ borderLeft: index === 0 ? "2px solid black" : 0 }}
          >
            {data[dataType.key] || 0}
          </td>
        ))}
        <td
          className="text-center text-small"
          style={{ borderLeft: "2px solid black" }}
        >
          <small>{rowNote}</small>
        </td>
      </tr>
      {otherKeys.map((otherKey) => (
        <AnalysisReportRow
          key={otherKey}
          variableName={otherKey}
          data={data[otherKey]}
          level={level + 1}
        />
      ))}
    </>
  );
}

function AnalysisReport({ analysisResult }) {
  return (
    <table className="table table-hover table-responsive">
      <thead>
        <tr>
          <th scope="col">Key</th>
          {DATA_TYPES_NULL_OR_UNDEFINED.map((dataType, index) => (
            <th
              key={dataType.key}
              scope="col"
              className="text-center"
              style={{ borderLeft: index === 0 ? "2px solid black" : 0 }}
            >
              {dataType.name}
            </th>
          ))}
          {DATA_TYPES_NON_NULL_NON_UNDEFINED.map((dataType, index) => (
            <th
              key={dataType.key}
              scope="col"
              className="text-center"
              style={{ borderLeft: index === 0 ? "2px solid black" : 0 }}
            >
              {dataType.name}
            </th>
          ))}
          <th
            scope="col"
            className="text-center"
            style={{ borderLeft: "2px solid black" }}
          >
            Note
          </th>
        </tr>
      </thead>
      <tbody>
        {Object.keys(analysisResult)
          .sort()
          .map((key) => (
            <AnalysisReportRow
              key={key}
              variableName={key}
              data={analysisResult[key]}
            />
          ))}
      </tbody>
    </table>
  );
}

function AnalysisReportContainer() {
  const { analysisResult, status, lastError, data } = useAnalyzerContext();
  if (status === FETCH_STATUS.PENDING) return null;
  return (
    <div className="mb-5">
      <div>
        <h3 className="mb-4">Analysis Report</h3>
        {status === FETCH_STATUS.LOADING && (
          <div>
            <AnalysisReportLoading dataLength={data.length} />
          </div>
        )}
        {status === FETCH_STATUS.SUCCESS && (
          <pre>
            <AnalysisReport analysisResult={analysisResult} />
          </pre>
        )}
        {status === FETCH_STATUS.FAILED && (
          <div className="alert alert-danger" role="alert">
            Something went wrong! Please recheck your credentials or connections
            <br />
            {lastError?.message}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="p-5 bg-light min-vh-100">
      <div className="p-5 shadow-sm rounded bg-white h-100">
        <div className="pt-2 sticky-top bg-white">
          <h1>ePurist</h1>
          <span>CouchDB healthchecker</span>
          <hr className="mb-5" />
        </div>
        <AnalyzerProvider>
          <Form />
          <AnalysisReportContainer />
        </AnalyzerProvider>
        <div style={{ minHeight: "100vh" }}></div>
      </div>
    </div>
  );
}

export default App;
