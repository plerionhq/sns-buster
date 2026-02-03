import { describe, test, expect } from 'bun:test';
import { GetTopicAttributes } from '../../src/actions/GetTopicAttributes';
import { GetDataProtectionPolicy } from '../../src/actions/GetDataProtectionPolicy';
import { ListSubscriptionsByTopic } from '../../src/actions/ListSubscriptionsByTopic';
import { ListTagsForResource } from '../../src/actions/ListTagsForResource';
import { Publish } from '../../src/actions/Publish';
import { PublishBatch } from '../../src/actions/PublishBatch';
import { DeleteTopic } from '../../src/actions/DeleteTopic';
import { SetTopicAttributes } from '../../src/actions/SetTopicAttributes';
import { Subscribe } from '../../src/actions/Subscribe';
import { TagResource } from '../../src/actions/TagResource';
import { UntagResource } from '../../src/actions/UntagResource';
import { AddPermission } from '../../src/actions/AddPermission';
import { RemovePermission } from '../../src/actions/RemovePermission';
import { PutDataProtectionPolicy } from '../../src/actions/PutDataProtectionPolicy';
import {
  getReadActions,
  getSafeActions,
  getAllActions,
  getActionsByMode,
} from '../../src/actions';
import { SNS_API_VERSION } from '../../src/utils/constants';

const TEST_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:test-topic';

describe('GetTopicAttributes', () => {
  const action = new GetTopicAttributes();

  test('has correct name', () => {
    expect(action.name).toBe('GetTopicAttributes');
  });

  test('is a read action', () => {
    expect(action.category).toBe('read');
  });

  test('is safe', () => {
    expect(action.safe).toBe(true);
  });

  test('uses TopicArn parameter', () => {
    expect(action.parameterName).toBe('TopicArn');
  });

  test('builds correct params', () => {
    const params = action.buildParams(TEST_TOPIC_ARN);

    expect(params.Action).toBe('GetTopicAttributes');
    expect(params.TopicArn).toBe(TEST_TOPIC_ARN);
    expect(params.Version).toBe(SNS_API_VERSION);
  });
});

describe('GetDataProtectionPolicy', () => {
  const action = new GetDataProtectionPolicy();

  test('has correct name', () => {
    expect(action.name).toBe('GetDataProtectionPolicy');
  });

  test('is a read action', () => {
    expect(action.category).toBe('read');
  });

  test('uses ResourceArn parameter', () => {
    expect(action.parameterName).toBe('ResourceArn');
  });

  test('builds correct params', () => {
    const params = action.buildParams(TEST_TOPIC_ARN);

    expect(params.Action).toBe('GetDataProtectionPolicy');
    expect(params.ResourceArn).toBe(TEST_TOPIC_ARN);
  });
});

describe('ListSubscriptionsByTopic', () => {
  const action = new ListSubscriptionsByTopic();

  test('has correct name', () => {
    expect(action.name).toBe('ListSubscriptionsByTopic');
  });

  test('is a read action', () => {
    expect(action.category).toBe('read');
  });

  test('uses TopicArn parameter', () => {
    expect(action.parameterName).toBe('TopicArn');
  });
});

describe('ListTagsForResource', () => {
  const action = new ListTagsForResource();

  test('uses ResourceArn parameter', () => {
    expect(action.parameterName).toBe('ResourceArn');
  });
});

describe('Publish', () => {
  const action = new Publish();

  test('is a write action', () => {
    expect(action.category).toBe('write');
  });

  test('is safe', () => {
    expect(action.safe).toBe(true);
  });

  test('includes Message in params', () => {
    const params = action.buildParams(TEST_TOPIC_ARN);

    expect(params.Message).toBeDefined();
    expect(params.Message.length).toBeGreaterThan(0);
  });
});

describe('PublishBatch', () => {
  const action = new PublishBatch();

  test('has correct name', () => {
    expect(action.name).toBe('PublishBatch');
  });

  test('is a write action', () => {
    expect(action.category).toBe('write');
  });

  test('is safe', () => {
    expect(action.safe).toBe(true);
  });

  test('includes batch entry params', () => {
    const params = action.buildParams(TEST_TOPIC_ARN);

    expect(params['PublishBatchRequestEntries.member.1.Id']).toBeDefined();
    expect(params['PublishBatchRequestEntries.member.1.Message']).toBeDefined();
  });
});

describe('DeleteTopic', () => {
  const action = new DeleteTopic();

  test('is a write action', () => {
    expect(action.category).toBe('write');
  });

  test('is NOT safe', () => {
    expect(action.safe).toBe(false);
  });
});

describe('SetTopicAttributes', () => {
  const action = new SetTopicAttributes();

  test('is NOT safe', () => {
    expect(action.safe).toBe(false);
  });

  test('includes AttributeName and AttributeValue in params', () => {
    const params = action.buildParams(TEST_TOPIC_ARN);

    expect(params.AttributeName).toBeDefined();
    expect(params.AttributeValue).toBeDefined();
  });
});

describe('Subscribe', () => {
  const action = new Subscribe();

  test('is safe', () => {
    expect(action.safe).toBe(true);
  });

  test('includes Protocol and Endpoint in params', () => {
    const params = action.buildParams(TEST_TOPIC_ARN);

    expect(params.Protocol).toBeDefined();
    expect(params.Endpoint).toBeDefined();
  });
});

describe('TagResource', () => {
  const action = new TagResource();

  test('is safe', () => {
    expect(action.safe).toBe(true);
  });

  test('includes tag params', () => {
    const params = action.buildParams(TEST_TOPIC_ARN);

    expect(params['Tags.member.1.Key']).toBeDefined();
    expect(params['Tags.member.1.Value']).toBeDefined();
  });
});

describe('UntagResource', () => {
  const action = new UntagResource();

  test('has correct name', () => {
    expect(action.name).toBe('UntagResource');
  });

  test('is a write action', () => {
    expect(action.category).toBe('write');
  });

  test('is safe', () => {
    expect(action.safe).toBe(true);
  });

  test('uses ResourceArn parameter', () => {
    expect(action.parameterName).toBe('ResourceArn');
  });

  test('includes TagKeys param', () => {
    const params = action.buildParams(TEST_TOPIC_ARN);

    expect(params['TagKeys.member.1']).toBeDefined();
  });
});

describe('AddPermission', () => {
  const action = new AddPermission();

  test('is safe', () => {
    expect(action.safe).toBe(true);
  });

  test('includes Label and permission params', () => {
    const params = action.buildParams(TEST_TOPIC_ARN);

    expect(params.Label).toBeDefined();
    expect(params['AWSAccountId.member.1']).toBeDefined();
    expect(params['ActionName.member.1']).toBeDefined();
  });
});

describe('RemovePermission', () => {
  const action = new RemovePermission();

  test('is NOT safe', () => {
    expect(action.safe).toBe(false);
  });

  test('includes Label param', () => {
    const params = action.buildParams(TEST_TOPIC_ARN);

    expect(params.Label).toBeDefined();
  });
});

describe('PutDataProtectionPolicy', () => {
  const action = new PutDataProtectionPolicy();

  test('is NOT safe', () => {
    expect(action.safe).toBe(false);
  });

  test('includes DataProtectionPolicy param as JSON', () => {
    const params = action.buildParams(TEST_TOPIC_ARN);

    expect(params.DataProtectionPolicy).toBeDefined();
    expect(() => JSON.parse(params.DataProtectionPolicy)).not.toThrow();
  });
});

describe('Action Registry', () => {
  describe('getReadActions', () => {
    test('returns only read actions', () => {
      const actions = getReadActions();

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.every(a => a.category === 'read')).toBe(true);
    });

    test('includes GetTopicAttributes', () => {
      const actions = getReadActions();
      const names = actions.map(a => a.name);

      expect(names).toContain('GetTopicAttributes');
    });

    test('does not include write actions', () => {
      const actions = getReadActions();
      const names = actions.map(a => a.name);

      expect(names).not.toContain('Publish');
      expect(names).not.toContain('DeleteTopic');
    });
  });

  describe('getSafeActions', () => {
    test('returns only safe actions', () => {
      const actions = getSafeActions();

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.every(a => a.safe)).toBe(true);
    });

    test('includes read actions', () => {
      const actions = getSafeActions();
      const names = actions.map(a => a.name);

      expect(names).toContain('GetTopicAttributes');
    });

    test('includes safe write actions', () => {
      const actions = getSafeActions();
      const names = actions.map(a => a.name);

      expect(names).toContain('Publish');
      expect(names).toContain('PublishBatch');
      expect(names).toContain('TagResource');
      expect(names).toContain('UntagResource');
    });

    test('returns exactly 10 safe actions', () => {
      const actions = getSafeActions();
      expect(actions.length).toBe(10);
    });

    test('does not include unsafe actions', () => {
      const actions = getSafeActions();
      const names = actions.map(a => a.name);

      expect(names).not.toContain('DeleteTopic');
      expect(names).not.toContain('SetTopicAttributes');
      expect(names).not.toContain('RemovePermission');
      expect(names).not.toContain('PutDataProtectionPolicy');
    });
  });

  describe('getAllActions', () => {
    test('returns exactly 14 actions', () => {
      const actions = getAllActions();
      expect(actions.length).toBe(14);
    });

    test('returns more actions than safe mode', () => {
      const actions = getAllActions();
      expect(actions.length).toBeGreaterThan(getSafeActions().length);
    });

    test('includes unsafe actions', () => {
      const actions = getAllActions();
      const names = actions.map(a => a.name);

      expect(names).toContain('DeleteTopic');
      expect(names).toContain('SetTopicAttributes');
      expect(names).toContain('RemovePermission');
      expect(names).toContain('PutDataProtectionPolicy');
    });
  });

  describe('getReadActions', () => {
    test('returns exactly 4 read actions', () => {
      const actions = getReadActions();
      expect(actions.length).toBe(4);
    });
  });

  describe('getActionsByMode', () => {
    test('read mode returns read actions', () => {
      const actions = getActionsByMode('read');
      expect(actions).toEqual(getReadActions());
    });

    test('safe mode returns safe actions', () => {
      const actions = getActionsByMode('safe');
      expect(actions).toEqual(getSafeActions());
    });

    test('all mode returns all actions', () => {
      const actions = getActionsByMode('all');
      expect(actions).toEqual(getAllActions());
    });
  });
});
