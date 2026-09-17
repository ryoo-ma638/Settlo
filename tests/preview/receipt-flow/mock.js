import { fixtureResponse } from './fixtures.js';
export const app = {};
export const getFunctions = () => ({});
export const httpsCallable = (_functions, name) => name === 'publishPaymentAddedNotifications'
  ? async ({ historyIds }) => ({ data: { receiptCount: historyIds.length, createdCount: historyIds.length } })
  : async ({ image }) => {
      await new Promise(resolve => setTimeout(resolve, 350));
      return fixtureResponse(image);
    };
