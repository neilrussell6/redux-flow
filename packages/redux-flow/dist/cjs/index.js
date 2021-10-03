'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var redux = require('redux');
var Bluebird = require('bluebird');
var ramda = require('ramda');
var jsUtilsArray = require('@nr6/js-utils-array');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var Bluebird__default = /*#__PURE__*/_interopDefaultLegacy(Bluebird);

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
    if (!ramda.isNil (waitForActionType) && type === waitForActionType) {
      waitForPromiseResolve (actionLog);
      actionLog = [];
      waitForActionType = null;
    }
    return next (action)
  };

  // store
  const store = redux.createStore (
    createRootReducer (),
    redux.applyMiddleware (f, ...middleware),
  );

  /**
   * waitFor
   * @param actionType
   * @returns {Promise}
   */
  const waitFor = actionType => new Bluebird__default["default"] ((res) => {
    waitForActionType = actionType;
    if (log) {
      console.log (`awaiting: ${waitForActionType}`);
    }
    waitForPromiseResolve = res;
  })
    .timeout (timeout)
    .catch (Bluebird.TimeoutError, () => actionLog);

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
      console.log (`dispatching: ${ramda.prop ('type') (action)}`);
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
      : ramda.last (expected);
    const promise = waitFor (_expected)
      .then (ramda.pluck ('type'))
      .then (actual => {
        const _actual = typeof expected === 'string'
          ? [ramda.last (actual)]
          : actual;
        const _expected = typeof expected === 'string'
          ? [expected]
          : ramda.prepend (ramda.prop ('type') (action)) (expected);
        return jsUtilsArray.matchSequenceThrow (_actual, _expected)
      });
    if (log) {
      console.log (`dispatching: ${ramda.prop ('type') (action)}`);
    }
    store.dispatch (action);
    return promise
  };

  // ...
  return ramda.pipe (
    ramda.assoc ('waitFor') (waitFor),
    ramda.assoc ('dispatchWaitFor') (dispatchWaitFor),
    ramda.assoc ('dispatchMatchSequence') (dispatchMatchSequence),
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
  return Bluebird__default["default"].resolve (callback (store))
};

exports.reduxFlow = reduxFlow;
