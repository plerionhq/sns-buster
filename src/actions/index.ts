import type { Action } from './base';
import { GetTopicAttributes } from './GetTopicAttributes';
import { GetDataProtectionPolicy } from './GetDataProtectionPolicy';
import { ListSubscriptionsByTopic } from './ListSubscriptionsByTopic';
import { ListTagsForResource } from './ListTagsForResource';
import { Publish } from './Publish';
import { PublishBatch } from './PublishBatch';
import { DeleteTopic } from './DeleteTopic';
import { SetTopicAttributes } from './SetTopicAttributes';
import { Subscribe } from './Subscribe';
import { TagResource } from './TagResource';
import { UntagResource } from './UntagResource';
import { AddPermission } from './AddPermission';
import { RemovePermission } from './RemovePermission';
import { PutDataProtectionPolicy } from './PutDataProtectionPolicy';

export const ALL_ACTIONS: Action[] = [
  // Read actions
  new GetTopicAttributes(),
  new GetDataProtectionPolicy(),
  new ListSubscriptionsByTopic(),
  new ListTagsForResource(),
  // Write actions (safe)
  new Publish(),
  new PublishBatch(),
  new Subscribe(),
  new TagResource(),
  new UntagResource(),
  new AddPermission(),
  // RemovePermission immediately after AddPermission to clean up (unsafe - only runs in --all mode)
  new RemovePermission(),
  // Write actions (unsafe)
  new SetTopicAttributes(),
  new PutDataProtectionPolicy(),
  // Destructive - always last
  new DeleteTopic(),
];

export function getReadActions(): Action[] {
  return ALL_ACTIONS.filter(action => action.category === 'read');
}

export function getSafeActions(): Action[] {
  return ALL_ACTIONS.filter(action => action.safe);
}

export function getAllActions(): Action[] {
  return ALL_ACTIONS;
}

export function getActionsByMode(mode: 'read' | 'safe' | 'all'): Action[] {
  switch (mode) {
    case 'read':
      return getReadActions();
    case 'safe':
      return getSafeActions();
    case 'all':
      return getAllActions();
  }
}

export * from './base';
export * from './types';
