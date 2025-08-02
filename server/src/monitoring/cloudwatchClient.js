// src/monitoring/cloudwatchClient.js

import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';

// CloudWatch client configuration
const cwClient = new CloudWatchClient({ region: process.env.AWS_REGION });

/**
 * Hakee metrikatistiikat CloudWatchista
 * @param {Object} params
 * @param {string} params.Namespace
 * @param {string} params.MetricName
 * @param {string[]} params.Statistics
 * @param {number} params.Period - jakson pituus sekunteina
 * @param {Date} params.StartTime
 * @param {Date} params.EndTime
 * @param {Array<{Name:string,Value:string}>} [params.Dimensions]
 * @returns {Promise<Array>} datapoints
 */
export async function getMetricStatistics({
  Namespace,
  MetricName,
  Statistics,
  Period,
  StartTime,
  EndTime,
  Dimensions = [],
}) {
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
 * Hakee API error rate -metriikan viimeisen x minuutin aikaväliltä
 * @param {number} minutes
 * @returns {Promise<Array>}
 */
export async function getApiErrorRate(minutes) {
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
 * Hakee API latency p95 -metriikan viimeisen x minuutin aikaväliltä
 * @param {number} minutes
 * @returns {Promise<Array>}
 */
export async function getApiLatencyP95(minutes) {
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
