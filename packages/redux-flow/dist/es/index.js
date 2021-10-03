import { matchSequenceThrow } from '@nr6/js-utils-array';
export { MatchSequenceMismatchError, MatchSequencePartialMatchError } from '@nr6/js-utils-array';
import { createStore, applyMiddleware } from 'redux';
import Bluebird, { TimeoutError } from 'bluebird';
import { pipe, assoc, prop, last, pluck, prepend, isNil } from 'ramda';

/**
 * @typedef {Object} ReduxFlowCoreResult
 * @property {function} waitFor - waits for the provided action to occur
 * @property {function} dispatchMatchSequence - dispatches the provided action (param 1) and validates the sequence of subsequent actions (param 2)
 * @property {function} dispatchWaitFor - dispatches the provided action (param 1) and waits for the provided action (param 2) to occur
 */

/**
 * reduxFlowCore
 *
 * Core redux-flow implementation, creates a store from the provided createRootReducer and middleware
 * and returns a number of useful utility functions:
 * - waitFor
 * - dispatchMatchSequence
 * - dispatchWaitFor
 *
 * @param config.createRootReducer
 * @param config.middleware
 * @param config.timeout
 * @param config.log
 * @returns ReduxFlowCoreResult
 */
const reduxFlowCore = ({ createRootReducer, middleware, timeout, log }) => {
  let actionLog = [];
  let waitForPromiseResolve = null;
  let waitForActionType = null;
  let actionIndex = 0;

  // watcher middleware
  const f = () => next => action => {
    actionLog.push (action);
    actionIndex ++;
    const { type } = action;
    if (log) {
      console.log (`${actionIndex} : ${type}`);
    }
    if (!isNil (waitForActionType) && type === waitForActionType) {
      waitForPromiseResolve (actionLog);
      actionLog = [];
      waitForActionType = null;
    }
    return next (action)
  };

  // store
  const store = createStore (
    createRootReducer (),
    applyMiddleware (f, ...middleware),
  );

  /**
   * waitFor
   * @param actionType
   * @returns {Promise}
   */
  const waitFor = actionType => new Bluebird ((res) => {
    waitForActionType = actionType;
    if (log) {
      console.log (`awaiting: ${waitForActionType}`);
    }
    waitForPromiseResolve = res;
  })
    .timeout (timeout)
    .catch (TimeoutError, () => actionLog);

  /**
   * dispatchWaitFor
   *
   * @param action
   * @param expected
   * @returns {*}
   */
  const dispatchWaitFor = (action, expected) => {
    const p = waitFor (expected);
    if (log) {
      console.log (`dispatching: ${prop ('type') (action)}`);
    }
    store.dispatch (action);
    return p
  };

  /**
   * dispatchMatchSequence
   *
   * @param action
   * @param expected
   * @returns {*}
   */
  const dispatchMatchSequence = (action, expected) => {
    const _expected = typeof expected === 'string'
      ? expected
      : last (expected);
    const promise = waitFor (_expected)
      .then (pluck ('type'))
      .then (actual => {
        const _actual = typeof expected === 'string'
          ? [last (actual)]
          : actual;
        const _expected = typeof expected === 'string'
          ? [expected]
          : prepend (prop ('type') (action)) (expected);
        return matchSequenceThrow (_actual, _expected)
      });
    if (log) {
      console.log (`dispatching: ${prop ('type') (action)}`);
    }
    store.dispatch (action);
    return promise
  };

  // ...
  return pipe (
    assoc ('waitFor') (waitFor),
    assoc ('dispatchWaitFor') (dispatchWaitFor),
    assoc ('dispatchMatchSequence') (dispatchMatchSequence),
  ) (store)
};

/**
 * reduxFlow
 *
 * redux-flow wrapper, that wraps callback function in Bluebird promise,
 * allowing MatchSequenceMismatchError and MatchSequencePartialMatchError errors that occur in callback function
 * to be caught and acted on.
 *
 * @param config.createRootReducer
 * @param config.middleware
 * @param config.timeout
 * @param config.log
 * @param callback
 * @returns {*}
 */
const reduxFlow = ({ createRootReducer, middleware, timeout = 200, log = false }, callback) => {
  const store = reduxFlowCore ({ createRootReducer, middleware, timeout, log });
  return Bluebird.resolve (callback (store))
};

export { reduxFlow };
