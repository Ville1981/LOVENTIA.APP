// --- REPLACE START: convert ESM to CommonJS; keep logic intact ---
'use strict';

const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');

// CloudWatch client configuration
const cwClient = new CloudWatchClient({ region: process.env.AWS_REGION });

/**
 * Fetches metric statistics from CloudWatch
 * @param {Object} params
 * @param {string} params.Namespace
 * @param {string} params.MetricName
 * @param {string[]} params.Statistics
 * @param {number} params.Period - period length in seconds
 * @param {Date} params.StartTime
 * @param {Date} params.EndTime
 * @param {Array<{Name:string,Value:string}>} [params.Dimensions]
 * @returns {Promise<Array>} datapoints
 */
async function getMetricStatistics({ Namespace, MetricName, Statistics, Period, StartTime, EndTime, Dimensions = [] }) {
  const command = new GetMetricStatisticsCommand({
    Namespace,
    MetricName,
    Statistics,
    Period,
    StartTime,
    EndTime,
    Dimensions,
  });
  const response = await cwClient.send(command);
  return response.Datapoints || [];
}

/**
 * Fetches API error rate metric for the last `minutes` minutes
 * @param {number} minutes
 * @returns {Promise<Array>}
 */
async function getApiErrorRate(minutes) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - minutes * 60000);
  return await getMetricStatistics({
    Namespace: 'Application/Metrics',
    MetricName: 'ErrorRate',
    Statistics: ['Average'],
    Period: 60,
    StartTime: startTime,
    EndTime: endTime,
  });
}

/**
 * Fetches API latency p95 metric for the last `minutes` minutes
 * @param {number} minutes
 * @returns {Promise<Array>}
 */
async function getApiLatencyP95(minutes) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - minutes * 60000);
  return await getMetricStatistics({
    Namespace: 'Application/Metrics',
    MetricName: 'Latency',
    Statistics: ['p95'],
    Period: 60,
    StartTime: startTime,
    EndTime: endTime,
  });
}

module.exports = {
  getMetricStatistics,
  getApiErrorRate,
  getApiLatencyP95,
};
// --- REPLACE END ---
