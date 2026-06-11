const axios = require("axios");

const PYTHON_TIMEOUT_MS = Number(
  process.env.PYTHON_REQUEST_TIMEOUT_MS || 300000,
);

function normalizePythonErrorMessage(value, fallback) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return null;
        const location = Array.isArray(item.loc)
          ? item.loc.join(".")
          : item.loc;
        const message =
          item.msg || item.message || item.detail || item.reason || null;
        if (location && message) return `${location}: ${message}`;
        return message || location || null;
      })
      .filter(Boolean);

    if (parts.length) {
      return parts.join("; ");
    }
  }

  if (value && typeof value === "object") {
    const direct =
      value.detail ||
      value.message ||
      value.error ||
      value.reason ||
      value.msg ||
      null;

    if (direct && direct !== value) {
      return normalizePythonErrorMessage(direct, fallback);
    }

    try {
      const json = JSON.stringify(value);
      if (json && json !== "{}") {
        return json;
      }
    } catch {}
  }

  return fallback;
}

function getPythonBaseUrl() {
  if (!process.env.AI_URL) {
    const error = new Error("AI_URL is not configured");
    error.statusCode = 500;
    throw error;
  }

  return process.env.AI_URL.replace(/\/+$/, "");
}

function buildPythonUrl(pathname) {
  return `${getPythonBaseUrl()}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function buildPythonError(error, url) {
  if (error.response) {
    const pythonError = new Error(
      normalizePythonErrorMessage(
        error.response.data?.detail ??
          error.response.data?.message ??
          error.response.data,
        `Python service request failed with ${error.response.status}`,
      ),
    );
    pythonError.statusCode = error.response.status;
    pythonError.source = "python";
    pythonError.details = error.response.data;
    pythonError.pythonUrl = url;
    return pythonError;
  }

  if (error.code === "ECONNABORTED") {
    const timeoutError = new Error(
      `Python service timed out after ${Math.round(PYTHON_TIMEOUT_MS / 1000)} seconds`,
    );
    timeoutError.statusCode = 504;
    timeoutError.source = "python";
    timeoutError.details = { code: error.code };
    timeoutError.pythonUrl = url;
    return timeoutError;
  }

  const networkError = new Error(
    error.message || "Unable to reach Python service",
  );
  networkError.statusCode = 502;
  networkError.source = "python";
  networkError.details = { code: error.code || null };
  networkError.pythonUrl = url;
  return networkError;
}

async function callPython({
  method = "get",
  path,
  data,
  params,
  responseType = "json",
  headers,
}) {
  const url = buildPythonUrl(path);
  const requestHeaders = {
    ...((data && typeof data === "object" && !Buffer.isBuffer(data)) ||
    typeof data === "string"
      ? { "Content-Type": "application/json" }
      : {}),
    ...(headers || {}),
  };
  console.log(
    `Calling Python service: {url:url,method:method,data:data,params:params}`,
  );
  try {
    const response = await axios({
      method,
      url,
      data,
      params,
      responseType,
      timeout: PYTHON_TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: requestHeaders,
    });

    return response.data;
  } catch (error) {
    throw buildPythonError(error, url);
  }
}

module.exports = {
  callPython,
};
