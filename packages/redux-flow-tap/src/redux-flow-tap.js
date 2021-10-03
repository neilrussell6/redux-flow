import { reduxFlow, MatchSequencePartialMatchError, MatchSequenceMismatchError } from '@nr6/redux-flow'

/**
 * reduxFlowTap
 *
 * redux-flow wrapper for TAP tests, that wraps callback function in Bluebird promise,
 * and catches MatchSequenceMismatchError and MatchSequencePartialMatchError errors that occur in callback function
 * and skips or fails test with error message.
 * Used to fail tests when sequence is a mismatch, or just skip when sequence is on track but not complete,
 * useful for redux integration tests that are in the process of being fulfilled.
 *
 * @param config
 * @param config.test
 * @param config.createRootReducer
 * @param config.middleware
 * @param config.timeout
 * @param callback
 * @returns {*}
 */
export const reduxFlowTap = ({ test, createRootReducer, middleware, timeout = 200, log = false }, callback) => {
  return reduxFlow ({ createRootReducer, middleware, timeout, log }, callback)
    .catch (MatchSequencePartialMatchError, (e) => {
      test.skip (e.message)
    })
    .catch (MatchSequenceMismatchError, (e) => {
      test.fail (e.message)
    })
}
