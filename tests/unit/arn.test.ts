import { describe, test, expect } from 'bun:test';
import {
  parseArn,
  parseSnsTopicArn,
  getRegionFromArn,
  getEndpointForRegion,
  ArnParseError,
} from '../../src/utils/arn';

describe('parseArn', () => {
  test('parses a valid SNS topic ARN', () => {
    const arn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
    const result = parseArn(arn);

    expect(result.partition).toBe('aws');
    expect(result.service).toBe('sns');
    expect(result.region).toBe('us-east-1');
    expect(result.accountId).toBe('123456789012');
    expect(result.resource).toBe('my-topic');
  });

  test('parses ARN with resource containing colons', () => {
    const arn = 'arn:aws:sns:us-west-2:123456789012:topic:with:colons';
    const result = parseArn(arn);

    expect(result.resource).toBe('topic:with:colons');
  });

  test('parses ARN with gov cloud partition', () => {
    const arn = 'arn:aws-us-gov:sns:us-gov-west-1:123456789012:my-topic';
    const result = parseArn(arn);

    expect(result.partition).toBe('aws-us-gov');
    expect(result.region).toBe('us-gov-west-1');
  });

  test('parses ARN with china partition', () => {
    const arn = 'arn:aws-cn:sns:cn-north-1:123456789012:my-topic';
    const result = parseArn(arn);

    expect(result.partition).toBe('aws-cn');
    expect(result.region).toBe('cn-north-1');
  });

  test('throws error for empty ARN', () => {
    expect(() => parseArn('')).toThrow(ArnParseError);
    expect(() => parseArn('')).toThrow('ARN cannot be empty');
  });

  test('throws error for ARN with insufficient parts', () => {
    expect(() => parseArn('arn:aws:sns')).toThrow(ArnParseError);
    expect(() => parseArn('arn:aws:sns')).toThrow('expected at least 6 colon-separated parts');
  });

  test('throws error for ARN not starting with arn:', () => {
    expect(() => parseArn('invalid:aws:sns:us-east-1:123456789012:topic')).toThrow(ArnParseError);
    expect(() => parseArn('invalid:aws:sns:us-east-1:123456789012:topic')).toThrow(
      "must start with 'arn:'"
    );
  });

  test('throws error for ARN with empty partition', () => {
    expect(() => parseArn('arn::sns:us-east-1:123456789012:topic')).toThrow(ArnParseError);
    expect(() => parseArn('arn::sns:us-east-1:123456789012:topic')).toThrow(
      'partition cannot be empty'
    );
  });

  test('throws error for ARN with empty service', () => {
    expect(() => parseArn('arn:aws::us-east-1:123456789012:topic')).toThrow(ArnParseError);
    expect(() => parseArn('arn:aws::us-east-1:123456789012:topic')).toThrow(
      'service cannot be empty'
    );
  });

  test('allows empty region (for global services)', () => {
    const arn = 'arn:aws:iam::123456789012:user/test';
    const result = parseArn(arn);

    expect(result.region).toBe('');
    expect(result.accountId).toBe('123456789012');
  });

  test('allows empty account ID', () => {
    const arn = 'arn:aws:s3:::my-bucket';
    const result = parseArn(arn);

    expect(result.accountId).toBe('');
    expect(result.resource).toBe('my-bucket');
  });
});

describe('parseSnsTopicArn', () => {
  test('parses valid SNS topic ARN and extracts topic name', () => {
    const arn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
    const result = parseSnsTopicArn(arn);

    expect(result.topicName).toBe('my-topic');
    expect(result.service).toBe('sns');
  });

  test('parses FIFO topic ARN', () => {
    const arn = 'arn:aws:sns:eu-west-1:123456789012:my-topic.fifo';
    const result = parseSnsTopicArn(arn);

    expect(result.topicName).toBe('my-topic.fifo');
  });

  test('throws error for non-SNS ARN', () => {
    const arn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';

    expect(() => parseSnsTopicArn(arn)).toThrow(ArnParseError);
    expect(() => parseSnsTopicArn(arn)).toThrow("service must be 'sns'");
  });

  test('throws error for SNS ARN without region', () => {
    const arn = 'arn:aws:sns::123456789012:my-topic';

    expect(() => parseSnsTopicArn(arn)).toThrow(ArnParseError);
    expect(() => parseSnsTopicArn(arn)).toThrow('region cannot be empty');
  });

  test('throws error for SNS ARN without account ID', () => {
    const arn = 'arn:aws:sns:us-east-1::my-topic';

    expect(() => parseSnsTopicArn(arn)).toThrow(ArnParseError);
    expect(() => parseSnsTopicArn(arn)).toThrow('account ID cannot be empty');
  });

  test('throws error for SNS ARN without topic name', () => {
    const arn = 'arn:aws:sns:us-east-1:123456789012:';

    expect(() => parseSnsTopicArn(arn)).toThrow(ArnParseError);
    expect(() => parseSnsTopicArn(arn)).toThrow('topic name cannot be empty');
  });
});

describe('getRegionFromArn', () => {
  test('extracts region from valid SNS topic ARN', () => {
    expect(getRegionFromArn('arn:aws:sns:us-east-1:123456789012:topic')).toBe('us-east-1');
    expect(getRegionFromArn('arn:aws:sns:eu-west-1:123456789012:topic')).toBe('eu-west-1');
    expect(getRegionFromArn('arn:aws:sns:ap-southeast-2:123456789012:topic')).toBe('ap-southeast-2');
  });

  test('extracts region from gov cloud ARN', () => {
    expect(getRegionFromArn('arn:aws-us-gov:sns:us-gov-west-1:123456789012:topic')).toBe(
      'us-gov-west-1'
    );
  });
});

describe('getEndpointForRegion', () => {
  test('generates correct endpoint for standard regions', () => {
    expect(getEndpointForRegion('us-east-1')).toBe('https://sns.us-east-1.amazonaws.com');
    expect(getEndpointForRegion('eu-west-1')).toBe('https://sns.eu-west-1.amazonaws.com');
    expect(getEndpointForRegion('ap-northeast-1')).toBe('https://sns.ap-northeast-1.amazonaws.com');
  });

  test('generates correct endpoint for gov cloud regions', () => {
    expect(getEndpointForRegion('us-gov-west-1')).toBe('https://sns.us-gov-west-1.amazonaws.com');
  });
});
