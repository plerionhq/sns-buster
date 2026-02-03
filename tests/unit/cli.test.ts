import { describe, test, expect, spyOn } from 'bun:test';
import { createCli, parseOptions } from '../../src/cli';

describe('CLI', () => {
  describe('createCli', () => {
    test('creates program with correct name', () => {
      const program = createCli();
      expect(program.name()).toBe('sns-buster');
    });

    test('creates program with version', () => {
      const program = createCli();
      expect(program.version()).toBe('0.1.0');
    });
  });

  describe('parseOptions', () => {
    test('exits with error when no topic ARN provided', () => {
      const exitSpy = spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
      const program = createCli();
      program.parse([], { from: 'user' });

      expect(() => parseOptions(program)).toThrow('process.exit');
      expect(errorSpy).toHaveBeenCalledWith('Error: topic ARN is required. Usage: sns-buster <topic-arn>');

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    test('uses provided topic ARN', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-west-2:123:my-topic'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.topicArn).toBe('arn:aws:sns:us-west-2:123:my-topic');
    });

    test('defaults to all mode', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-east-1:123:test'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.mode).toBe('all');
    });

    test('sets read mode with --read flag', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-east-1:123:test', '--read'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.mode).toBe('read');
    });

    test('sets safe mode with --safe flag', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-east-1:123:test', '--safe'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.mode).toBe('safe');
    });

    test('read mode takes precedence over safe', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-east-1:123:test', '--read', '--safe'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.mode).toBe('read');
    });

    test('sets region from --region flag', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-east-1:123:test', '--region', 'eu-west-1'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.region).toBe('eu-west-1');
    });

    test('sets region from -r flag', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-east-1:123:test', '-r', 'ap-southeast-2'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.region).toBe('ap-southeast-2');
    });

    test('region is undefined when not provided', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-east-1:123:test'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.region).toBeUndefined();
    });

    test('verbose is false by default', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-east-1:123:test'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.verbose).toBe(false);
    });

    test('sets verbose with -v flag', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-east-1:123:test', '-v'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.verbose).toBe(true);
    });

    test('sets verbose with --verbose flag', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-east-1:123:test', '--verbose'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.verbose).toBe(true);
    });

    test('uses default output directory', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-east-1:123:test'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.outputDir).toBe('output');
    });

    test('sets output directory with -o flag', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-east-1:123:test', '-o', 'results'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.outputDir).toBe('results');
    });

    test('combines topic ARN with flags', () => {
      const program = createCli();
      program.parse([
        'arn:aws:sns:us-east-1:123:test',
        '--safe',
        '-v',
        '-r', 'us-west-2',
      ], { from: 'user' });
      const options = parseOptions(program);

      expect(options.topicArn).toBe('arn:aws:sns:us-east-1:123:test');
      expect(options.mode).toBe('safe');
      expect(options.verbose).toBe(true);
      expect(options.region).toBe('us-west-2');
    });

    test('compare is undefined by default', () => {
      const program = createCli();
      program.parse(['arn:aws:sns:us-east-1:123:test'], { from: 'user' });
      const options = parseOptions(program);

      expect(options.compare).toBeUndefined();
    });

    test('sets compare topics with --compare flag', () => {
      const program = createCli();
      program.parse([
        '--compare', 'arn:aws:sns:us-east-1:111:allowed-topic', 'arn:aws:sns:us-east-1:222:denied-topic',
      ], { from: 'user' });
      const options = parseOptions(program);

      expect(options.topicArn).toBe('arn:aws:sns:us-east-1:111:allowed-topic');
      expect(options.compare).toBe('arn:aws:sns:us-east-1:222:denied-topic');
    });

    test('compare mode exits with error when no ARNs provided', () => {
      const exitSpy = spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
      const program = createCli();
      program.parse(['--compare'], { from: 'user' });

      expect(() => parseOptions(program)).toThrow('process.exit');
      expect(errorSpy).toHaveBeenCalledWith('Error: --compare requires two topic ARNs: --compare <allow-arn> <deny-arn>');

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    test('compare mode exits with error when only one ARN provided', () => {
      const exitSpy = spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
      const program = createCli();
      program.parse(['--compare', 'arn:aws:sns:us-east-1:111:custom-allow'], { from: 'user' });

      expect(() => parseOptions(program)).toThrow('process.exit');
      expect(errorSpy).toHaveBeenCalledWith('Error: --compare requires two topic ARNs: --compare <allow-arn> <deny-arn>');

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    test('compare mode works with other flags', () => {
      const program = createCli();
      program.parse([
        '--compare', 'arn:aws:sns:us-east-1:111:allowed', 'arn:aws:sns:us-east-1:222:denied',
        '--safe',
        '-v',
      ], { from: 'user' });
      const options = parseOptions(program);

      expect(options.topicArn).toBe('arn:aws:sns:us-east-1:111:allowed');
      expect(options.compare).toBe('arn:aws:sns:us-east-1:222:denied');
      expect(options.mode).toBe('safe');
      expect(options.verbose).toBe(true);
    });

    test('request-mutations mode exits with error when no ARNs provided', () => {
      const exitSpy = spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
      const program = createCli();
      program.parse(['--request-mutations'], { from: 'user' });

      expect(() => parseOptions(program)).toThrow('process.exit');
      expect(errorSpy).toHaveBeenCalledWith('Error: --request-mutations requires two topic ARNs: --request-mutations <allow-arn> <deny-arn>');

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    test('request-mutations mode sets both topics', () => {
      const program = createCli();
      program.parse([
        '--request-mutations', 'arn:aws:sns:us-east-1:111:allowed', 'arn:aws:sns:us-east-1:222:denied',
      ], { from: 'user' });
      const options = parseOptions(program);

      expect(options.topicArn).toBe('arn:aws:sns:us-east-1:111:allowed');
      expect(options.compare).toBe('arn:aws:sns:us-east-1:222:denied');
      expect(options.requestMutations).toBe(true);
    });
  });
});
