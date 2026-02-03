export interface ParsedArn {
  partition: string;
  service: string;
  region: string;
  accountId: string;
  resource: string;
}

export class ArnParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArnParseError';
  }
}

export function parseArn(arn: string): ParsedArn {
  if (!arn) {
    throw new ArnParseError('ARN cannot be empty');
  }

  const parts = arn.split(':');

  if (parts.length < 6) {
    throw new ArnParseError(`Invalid ARN format: expected at least 6 colon-separated parts, got ${parts.length}`);
  }

  const [prefix, partition, service, region, accountId, ...resourceParts] = parts;

  if (prefix !== 'arn') {
    throw new ArnParseError(`Invalid ARN: must start with 'arn:', got '${prefix}:'`);
  }

  if (!partition) {
    throw new ArnParseError('Invalid ARN: partition cannot be empty');
  }

  if (!service) {
    throw new ArnParseError('Invalid ARN: service cannot be empty');
  }

  const resource = resourceParts.join(':');

  return {
    partition,
    service,
    region,
    accountId,
    resource,
  };
}

export function parseSnsTopicArn(arn: string): ParsedArn & { topicName: string } {
  const parsed = parseArn(arn);

  if (parsed.service !== 'sns') {
    throw new ArnParseError(`Invalid SNS ARN: service must be 'sns', got '${parsed.service}'`);
  }

  if (!parsed.region) {
    throw new ArnParseError('Invalid SNS topic ARN: region cannot be empty');
  }

  if (!parsed.accountId) {
    throw new ArnParseError('Invalid SNS topic ARN: account ID cannot be empty');
  }

  if (!parsed.resource) {
    throw new ArnParseError('Invalid SNS topic ARN: topic name cannot be empty');
  }

  return {
    ...parsed,
    topicName: parsed.resource,
  };
}

export function getRegionFromArn(arn: string): string {
  const parsed = parseSnsTopicArn(arn);
  return parsed.region;
}

export function getEndpointForRegion(region: string): string {
  return `https://sns.${region}.amazonaws.com`;
}
