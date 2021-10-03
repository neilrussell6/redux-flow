import tape from 'tape'
import tapePromise from 'tape-promise'
import { combineReducers } from 'redux'
import sinon from 'sinon'
import { keys, pluck, isNil } from 'ramda'
import { createReducer } from '@reduxjs/toolkit'
import { matchSequenceThrow, MatchSequenceMismatchError, MatchSequencePartialMatchError } from '@nr6/js-utils-array'

import * as SUT from './redux-flow'

tapePromise (tape) ('redux-flow', (t) => {

  // -----------------------------------------
  // callback
  // -----------------------------------------

  t.test ('reduxFlow : callback', async (t) => {
    // given ... a create root reducer function and no middleware
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware = []

    // when ... we wrap our callback in redux flow
    const callbackStub = sinon.stub ()
    await SUT.reduxFlow ({ createRootReducer, middleware }, callbackStub)

    // then ... should provide our callback with the expected store and utility functions
    const callbackArg = callbackStub.args[0][0]
    t.same (keys (callbackArg), [
      'dispatch',
      'subscribe',
      'getState',
      'replaceReducer',
      '@@observable',
      'waitFor',
      'dispatchWaitFor',
      'dispatchMatchSequence',
    ])
    t.end ()
  })

  // -----------------------------------------
  // waitFor
  // -----------------------------------------

  t.test ('reduxFlow : waitFor : success (1 middleware)', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches action3 on action2
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action2') {
        dispatch ({ type: 'action3' })
      }
    }
    const middleware = [middleware1]

    // when
    // ... we use the provided waitFor in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    let actions1
    let actions2
    let waitForSpy
    const callback = async (store) => {
      waitForSpy = sinon.spy (store, 'waitFor')
      const { dispatch, waitFor } = store

      const promise1 = waitFor ('action1')
      dispatch ({ type: 'action1' })
      actions1 = await promise1

      const promise2 = waitFor ('action3')
      dispatch ({ type: 'action2' })
      actions2 = await promise2
    }
    await SUT.reduxFlow ({ createRootReducer, middleware }, callback)

    // then
    // ... should succeed as expected
    // ... having gathered all actions in response to dispatches
    t.same (actions1, [{ type: 'action1' }])
    t.same (actions2, [{ type: 'action2' }, { type: 'action3' }])
    // ... having waited for action 1 and 3 as expected
    t.same (waitForSpy.args, [['action1'], ['action3']])
    t.end ()
  })

  t.test ('reduxFlow : waitFor : success (2 middleware)', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches action2 then action3 on action1
    // ... and middleware that dispatches action5 on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'action2' })
        dispatch ({ type: 'action3' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided waitFor in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    let actions1
    let actions2
    let waitForSpy
    const callback = async (store) => {
      waitForSpy = sinon.spy (store, 'waitFor')
      const { dispatch, waitFor } = store

      const promise1 = waitFor ('action3')
      dispatch ({ type: 'action1' })
      actions1 = await promise1

      const promise2 = waitFor ('action5')
      dispatch ({ type: 'action4' })
      actions2 = await promise2
    }
    await SUT.reduxFlow ({ createRootReducer, middleware }, callback)

    // then
    // ... should succeed as expected
    // ... having gathered all actions in response to dispatches
    t.same (actions1, [{ type: 'action1' }, { type: 'action2' }, { type: 'action3' }])
    t.same (actions2, [{ type: 'action4' }, { type: 'action5' }])
    // ... having waited for action 3 and 5 as expected
    t.same (waitForSpy.args, [['action3'], ['action5']])
    t.end ()
  })

  t.test ('reduxFlow : waitFor : success (timeout)', async (t) => {
    // given
    // ... a create root reducer function
    // ... and no middleware
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware = []

    // when
    // ... we use the provided waitFor in our callback to wait for
    // ... and gather a list of actions that will never occur in response
    // ... to our callback's dispatch
    let actions
    let waitForSpy
    const callback = async (store) => {
      waitForSpy = sinon.spy (store, 'waitFor')
      const { dispatch, waitFor } = store

      const promise = waitFor ('action2')
      dispatch ({ type: 'action1' })
      actions = await promise
    }
    await SUT.reduxFlow ({ createRootReducer, middleware }, callback)

    // then
    // ... should succeed as expected
    // ... having gathered all actions in response to dispatches
    t.same (actions, [{ type: 'action1' }])
    // ... having waited for action 2 as expected
    t.same (waitForSpy.args, [['action2']])
    t.end ()
  })

  t.test ('reduxFlow : waitFor : success using matchSequenceThrow', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches action2 then action3 on action1
    // ... and middleware that dispatches action5 on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'action2' })
        dispatch ({ type: 'action3' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided waitFor in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    // ... and validate these action using matchSequenceThrow
    // ... and all actions match all expectations in response to each dispatch
    let actions1
    let actions2
    let waitForSpy
    let matchSequenceThrowSpy = sinon.stub ().callsFake (matchSequenceThrow)
    const callback = async (store) => {
      waitForSpy = sinon.spy (store, 'waitFor')
      const { dispatch, waitFor } = store

      const promise1 = waitFor ('action3')
      dispatch ({ type: 'action1' })
      actions1 = await promise1
      matchSequenceThrowSpy (pluck ('type') (actions1), ['action1', 'action2', 'action3'])

      const promise2 = waitFor ('action5')
      dispatch ({ type: 'action4' })
      actions2 = await promise2
      matchSequenceThrowSpy (pluck ('type') (actions2), ['action4', 'action5'])
    }
    await SUT.reduxFlow ({ createRootReducer, middleware }, callback)

    // then
    // ... should succeed as expected
    // ... having gathered all actions in response to dispatches
    t.same (actions1, [{ type: 'action1' }, { type: 'action2' }, { type: 'action3' }])
    t.same (actions2, [{ type: 'action4' }, { type: 'action5' }])
    // ... having waited for action 3 and 5 as expected
    t.same (waitForSpy.args, [['action3'], ['action5']])
    // ... having matched all expected sequences
    t.same (matchSequenceThrowSpy.args, [
      [
        ['action1', 'action2', 'action3'], // actual
        ['action1', 'action2', 'action3'], // expected
      ],
      [
        ['action4', 'action5'], // actual
        ['action4', 'action5'], // expected
      ],
    ])
    t.end ()
  })

  t.test ('reduxFlow : waitFor : success using matchSequenceThrow (unexpected action after final expected action)', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches action2 then action3 on action1
    // ... and middleware that dispatches action5 then an unexpected on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'action2' })
        dispatch ({ type: 'action3' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
        dispatch ({ type: 'unexpected action' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided waitFor in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    // ... and validate these action using matchSequenceThrow
    // ... and all actions match all expectations in response to each dispatch
    // ... even though an unexpected action occurs after the final expected action
    let actions1
    let actions2
    let waitForSpy
    let matchSequenceThrowSpy = sinon.stub ().callsFake (matchSequenceThrow)
    const callback = async (store) => {
      waitForSpy = sinon.spy (store, 'waitFor')
      const { dispatch, waitFor } = store

      const promise1 = waitFor ('action3')
      dispatch ({ type: 'action1' })
      actions1 = await promise1
      matchSequenceThrowSpy (pluck ('type') (actions1), ['action1', 'action2', 'action3'])

      const promise2 = waitFor ('action5')
      dispatch ({ type: 'action4' })
      actions2 = await promise2
      matchSequenceThrowSpy (pluck ('type') (actions2), ['action4', 'action5'])
    }
    await SUT.reduxFlow ({ createRootReducer, middleware }, callback)

    // then
    // ... should succeed as expected
    // ... having gathered all actions in response to dispatches
    t.same (actions1, [{ type: 'action1' }, { type: 'action2' }, { type: 'action3' }])
    t.same (actions2, [{ type: 'action4' }, { type: 'action5' }])
    // ... having waited for action 3 and 5 as expected
    t.same (waitForSpy.args, [['action3'], ['action5']])
    // ... having matched all expected sequences
    t.same (matchSequenceThrowSpy.args, [
      [
        ['action1', 'action2', 'action3'], // actual
        ['action1', 'action2', 'action3'], // expected
      ],
      [
        ['action4', 'action5'], // actual
        ['action4', 'action5'], // expected
      ],
    ])
    t.end ()
  })

  t.test ('reduxFlow : waitFor : failure using matchSequenceThrow (mismatch during first sequence)', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches an unexpected action before action3 on action1
    // ... and middleware that dispatches action5 on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'unexpected action' })
        dispatch ({ type: 'action3' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided waitFor in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    // ... and validate these action using matchSequenceThrow
    // ... but after the first dispatch an unexpected action occurs
    let actions1
    let actions2
    let waitForSpy
    let matchSequenceThrowSpy = sinon.stub ().callsFake (matchSequenceThrow)
    const callback = async (store) => {
      waitForSpy = sinon.spy (store, 'waitFor')
      const { dispatch, waitFor } = store

      const promise1 = waitFor ('action3')
      dispatch ({ type: 'action1' })
      actions1 = await promise1
      matchSequenceThrowSpy (pluck ('type') (actions1), ['action1', 'action2', 'action3'])

      const promise2 = waitFor ('action5')
      dispatch ({ type: 'action4' })
      actions2 = await promise2
      matchSequenceThrowSpy (pluck ('type') (actions2), ['action4', 'action5'])
    }

    // then
    // ... should fail with the expected error
    await t.rejects (() => SUT.reduxFlow ({ createRootReducer, middleware }, callback), MatchSequenceMismatchError)
    // ... having gathered all actions in response to first dispatch
    // ... but none of the second
    t.same (actions1, [{ type: 'action1' }, { type: 'unexpected action' }, { type: 'action3' }])
    t.ok (isNil (actions2))
    // ... having only waited for the first action
    // ... not the second
    t.same (waitForSpy.args, [['action3']])
    // ... having only matched the first expected sequence not the second
    t.same (matchSequenceThrowSpy.args, [
      [
        ['action1', 'unexpected action', 'action3'], // actual
        ['action1', 'action2', 'action3'], // expected
      ],
    ])
    t.end ()
  })

  t.test ('reduxFlow : waitFor : failure using matchSequenceThrow (partial match during first sequence)', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches a action2 on action1
    // ... and middleware that dispatches action5 on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'action2' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided waitFor in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    // ... and validate these action using matchSequenceThrow
    // ... but not all of the first sequence's expectations are matched (action 3 never happens, and waitFor times out)
    let actions1
    let actions2
    let waitForSpy
    let matchSequenceThrowSpy = sinon.stub ().callsFake (matchSequenceThrow)
    const callback = async (store) => {
      waitForSpy = sinon.spy (store, 'waitFor')
      const { dispatch, waitFor } = store

      const promise1 = waitFor ('action3')
      dispatch ({ type: 'action1' })
      actions1 = await promise1
      matchSequenceThrowSpy (pluck ('type') (actions1), ['action1', 'action2', 'action3'])

      const promise2 = waitFor ('action5')
      dispatch ({ type: 'action4' })
      actions2 = await promise2
      matchSequenceThrowSpy (pluck ('type') (actions2), ['action4', 'action5'])
    }

    // then
    // ... should fail with the expected error
    await t.rejects (() => SUT.reduxFlow ({ createRootReducer, middleware }, callback), MatchSequencePartialMatchError)
    // ... having gathered all actions in response to first dispatch
    // ... but none of the second
    t.same (actions1, [{ type: 'action1' }, { type: 'action2' }])
    t.ok (isNil (actions2))
    // ... having only waited for the first action
    // ... not the second
    t.same (waitForSpy.args, [['action3']])
    // ... having only matched the first expected sequence not the second
    t.same (matchSequenceThrowSpy.args, [
      [
        ['action1', 'action2'], // actual
        ['action1', 'action2', 'action3'], // expected
      ],
    ])
    t.end ()
  })

  t.test ('reduxFlow : waitFor : failure using matchSequenceThrow (partial match during second sequence)', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches a action2 then action2 on action1
    // ... and middleware that dispatches action5 on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'action2' })
        dispatch ({ type: 'action3' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided waitFor in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    // ... and validate these action using matchSequenceThrow
    // ... but not all of the second sequence's expectations are matched (action 6 never happens, and waitFor times out)
    let actions1
    let actions2
    let waitForSpy
    let matchSequenceThrowSpy = sinon.stub ().callsFake (matchSequenceThrow)
    const callback = async (store) => {
      waitForSpy = sinon.spy (store, 'waitFor')
      const { dispatch, waitFor } = store

      const promise1 = waitFor ('action3')
      dispatch ({ type: 'action1' })
      actions1 = await promise1
      matchSequenceThrowSpy (pluck ('type') (actions1), ['action1', 'action2', 'action3'])

      const promise2 = waitFor ('action6')
      dispatch ({ type: 'action4' })
      actions2 = await promise2
      matchSequenceThrowSpy (pluck ('type') (actions2), ['action4', 'action5', 'action6'])
    }

    // then
    // ... should fail with the expected error
    await t.rejects (() => SUT.reduxFlow ({ createRootReducer, middleware }, callback), MatchSequencePartialMatchError)
    // ... having gathered all actions in response to first and second dispatches
    t.same (actions1, [{ type: 'action1' }, { type: 'action2' }, { type: 'action3' }])
    t.same (actions2, [{ type: 'action4' }, { type: 'action5' }])
    // ... having waited for all expected actions
    t.same (waitForSpy.args, [['action3'], ['action6']])
    // ... having matched all expected sequences
    t.same (matchSequenceThrowSpy.args, [
      [
        ['action1', 'action2', 'action3'], // actual
        ['action1', 'action2', 'action3'], // expected
      ],
      [
        ['action4', 'action5'], // actual
        ['action4', 'action5', 'action6'], // expected
      ],
    ])
    t.end ()
  })

  // -----------------------------------------
  // dispatchWaitFor
  // -----------------------------------------

  t.test ('reduxFlow : dispatchWaitFor : success using matchSequenceThrow', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches action2 then action3 on action1
    // ... and middleware that dispatches action5 on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'action2' })
        dispatch ({ type: 'action3' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided dispatchWaitFor in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    // ... and validate these action using matchSequenceThrow
    // ... and all actions match all expectations in response to each dispatch
    let actions1
    let actions2
    let dispatchWaitForSpy
    let matchSequenceThrowSpy = sinon.stub ().callsFake (matchSequenceThrow)
    const callback = async (store) => {
      dispatchWaitForSpy = sinon.spy (store, 'dispatchWaitFor')
      const { dispatchWaitFor } = store

      actions1 = await dispatchWaitFor ({ type: 'action1' }, 'action3')
      matchSequenceThrowSpy (pluck ('type') (actions1), ['action1', 'action2', 'action3'])

      actions2 = await dispatchWaitFor ({ type: 'action4' }, 'action5')
      matchSequenceThrowSpy (pluck ('type') (actions2), ['action4', 'action5'])
    }
    await SUT.reduxFlow ({ createRootReducer, middleware }, callback)

    // then
    // ... should succeed as expected
    t.same (actions1, [{ type: 'action1' }, { type: 'action2' }, { type: 'action3' }])
    t.same (actions2, [{ type: 'action4' }, { type: 'action5' }])
    // ... having waited for action 3 and 5 as expected
    t.same (dispatchWaitForSpy.args, [
      [{ type: 'action1' }, 'action3'],
      [{ type: 'action4' }, 'action5'],
    ])
    // ... having matched all expected sequences
    t.same (matchSequenceThrowSpy.args, [
      [
        ['action1', 'action2', 'action3'], // actual
        ['action1', 'action2', 'action3'], // expected
      ],
      [
        ['action4', 'action5'], // actual
        ['action4', 'action5'], // expected
      ],
    ])
    t.end ()
  })

  t.test ('reduxFlow : dispatchWaitFor : failure using matchSequenceThrow (mismatch during first sequence)', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches an unexpected action before action3 on action1
    // ... and middleware that dispatches action5 on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'unexpected action' })
        dispatch ({ type: 'action3' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided dispatchWaitFor in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    // ... and validate these action using matchSequenceThrow
    // ... but after the first dispatch an unexpected action occurs
    let actions1
    let actions2
    let dispatchWaitForSpy
    let matchSequenceThrowSpy = sinon.stub ().callsFake (matchSequenceThrow)
    const callback = async (store) => {
      dispatchWaitForSpy = sinon.spy (store, 'dispatchWaitFor')
      const { dispatchWaitFor } = store

      actions1 = await dispatchWaitFor ({ type: 'action1' }, 'action3')
      matchSequenceThrowSpy (pluck ('type') (actions1), ['action1', 'action2', 'action3'])

      actions2 = await dispatchWaitFor ({ type: 'action4' }, 'action5')
      matchSequenceThrowSpy (pluck ('type') (actions2), ['action4', 'action5'])
    }

    // then
    // ... should fail with the expected error
    await t.rejects (() => SUT.reduxFlow ({ createRootReducer, middleware }, callback), MatchSequenceMismatchError)
    // ... having gathered all actions in response to first dispatch
    // ... but none of the second
    t.same (actions1, [{ type: 'action1' }, { type: 'unexpected action' }, { type: 'action3' }])
    t.ok (isNil (actions2))
    // ... having only waited for the first action
    // ... not the second
    t.same (dispatchWaitForSpy.args, [
      [{ type: 'action1' }, 'action3'],
    ])
    // ... having only matched the first expected sequence not the second
    t.same (matchSequenceThrowSpy.args, [
      [
        ['action1', 'unexpected action', 'action3'], // actual
        ['action1', 'action2', 'action3'], // expected
      ],
    ])
    t.end ()
  })

  t.test ('reduxFlow : dispatchWaitFor : failure using matchSequenceThrow (partial match during first sequence)', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches a action2 on action1
    // ... and middleware that dispatches action5 on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'action2' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided dispatchWaitFor in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    // ... and validate these action using matchSequenceThrow
    // ... but not all of the first sequence's expectations are matched (action 3 never happens, and dispatchWaitFor times out)
    let actions1
    let actions2
    let dispatchWaitForSpy
    let matchSequenceThrowSpy = sinon.stub ().callsFake (matchSequenceThrow)
    const callback = async (store) => {
      dispatchWaitForSpy = sinon.spy (store, 'dispatchWaitFor')
      const { dispatchWaitFor } = store

      actions1 = await dispatchWaitFor ({ type: 'action1' }, 'action3')
      matchSequenceThrowSpy (pluck ('type') (actions1), ['action1', 'action2', 'action3'])

      actions2 = await dispatchWaitFor ({ type: 'action4' }, 'action5')
      matchSequenceThrowSpy (pluck ('type') (actions2), ['action4', 'action5'])
    }

    // then
    // ... should fail with the expected error
    await t.rejects (() => SUT.reduxFlow ({ createRootReducer, middleware }, callback), MatchSequencePartialMatchError)
    // ... having gathered all actions in response to first dispatch
    // ... but none of the second
    t.same (actions1, [{ type: 'action1' }, { type: 'action2' }])
    t.ok (isNil (actions2))
    // ... having only waited for the first action
    // ... not the second
    t.same (dispatchWaitForSpy.args, [
      [{ type: 'action1' }, 'action3'],
    ])
    // ... having only matched the first expected sequence not the second
    t.same (matchSequenceThrowSpy.args, [
      [
        ['action1', 'action2'], // actual
        ['action1', 'action2', 'action3'], // expected
      ],
    ])
    t.end ()
  })

  t.test ('reduxFlow : dispatchWaitFor : failure using matchSequenceThrow (partial match during second sequence)', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches a action2 then action2 on action1
    // ... and middleware that dispatches action5 on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'action2' })
        dispatch ({ type: 'action3' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided dispatchWaitFor in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    // ... and validate these action using matchSequenceThrow
    // ... but not all of the second sequence's expectations are matched (action 6 never happens, and dispatchWaitFor times out)
    let actions1
    let actions2
    let dispatchWaitForSpy
    let matchSequenceThrowSpy = sinon.stub ().callsFake (matchSequenceThrow)
    const callback = async (store) => {
      dispatchWaitForSpy = sinon.spy (store, 'dispatchWaitFor')
      const { dispatchWaitFor } = store

      actions1 = await dispatchWaitFor ({ type: 'action1' }, 'action3')
      matchSequenceThrowSpy (pluck ('type') (actions1), ['action1', 'action2', 'action3'])

      actions2 = await dispatchWaitFor ({ type: 'action4' }, 'action6')
      matchSequenceThrowSpy (pluck ('type') (actions2), ['action4', 'action5', 'action6'])
    }

    // then
    // ... should fail with the expected error
    await t.rejects (() => SUT.reduxFlow ({ createRootReducer, middleware }, callback), MatchSequencePartialMatchError)
    // ... having gathered all actions in response to first and second dispatches
    t.same (actions1, [{ type: 'action1' }, { type: 'action2' }, { type: 'action3' }])
    t.same (actions2, [{ type: 'action4' }, { type: 'action5' }])
    // ... having waited for all expected actions
    t.same (dispatchWaitForSpy.args, [
      [{ type: 'action1' }, 'action3'],
      [{ type: 'action4' }, 'action6'],
    ])
    // ... having matched all expected sequences
    t.same (matchSequenceThrowSpy.args, [
      [
        ['action1', 'action2', 'action3'], // actual
        ['action1', 'action2', 'action3'], // expected
      ],
      [
        ['action4', 'action5'], // actual
        ['action4', 'action5', 'action6'], // expected
      ],
    ])
    t.end ()
  })

  // -----------------------------------------
  // dispatchMatchSequence
  // -----------------------------------------

  t.test ('reduxFlow : dispatchMatchSequence : success', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches action2 then action3 on action1
    // ... and middleware that dispatches action5 on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'action2' })
        dispatch ({ type: 'action3' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided dispatchMatchSequence in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    // ... and all actions match all expectations in response to each dispatch
    let dispatchMatchSequenceSpy
    const callback = async (store) => {
      dispatchMatchSequenceSpy = sinon.spy (store, 'dispatchMatchSequence')
      const { dispatchMatchSequence } = store
      await dispatchMatchSequence ({ type: 'action1' }, ['action2', 'action3'])
      await dispatchMatchSequence ({ type: 'action4' }, ['action5'])
    }
    await SUT.reduxFlow ({ createRootReducer, middleware }, callback)

    // then
    // ... should succeed as expected
    // ... having waited for all expected action sequences
    t.same (dispatchMatchSequenceSpy.args, [
      [{ type: 'action1' }, ['action2', 'action3']],
      [{ type: 'action4' }, ['action5']],
    ])
    t.end ()
  })

  t.test ('reduxFlow : dispatchMatchSequence : failure (mismatch during first sequence)', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches an unexpected action before action3 on action1
    // ... and middleware that dispatches action5 on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'unexpected action' })
        dispatch ({ type: 'action3' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided dispatchMatchSequence in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    // ... but after the first dispatch an unexpected action occurs
    let dispatchMatchSequenceSpy
    const callback = async (store) => {
      dispatchMatchSequenceSpy = sinon.spy (store, 'dispatchMatchSequence')
      const { dispatchMatchSequence } = store
      await dispatchMatchSequence ({ type: 'action1' }, ['action2', 'action3'])
      await dispatchMatchSequence ({ type: 'action4' }, ['action5'])
    }

    // then
    // ... should fail with the expected error
    await t.rejects (() => SUT.reduxFlow ({ createRootReducer, middleware }, callback), MatchSequenceMismatchError)
    // ... having only waited for the first sequence of actions
    // ... not the second
    t.same (dispatchMatchSequenceSpy.args, [
      [{ type: 'action1' }, ['action2', 'action3']],
    ])
    t.end ()
  })

  t.test ('reduxFlow : dispatchMatchSequence : failure (partial match during first sequence)', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches a action2 on action1
    // ... and middleware that dispatches action5 on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'action2' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided dispatchMatchSequence in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    // ... but not all of the first sequence's expectations are matched (action 3 never happens, and dispatchMatchSequence times out)
    let dispatchMatchSequenceSpy
    const callback = async (store) => {
      dispatchMatchSequenceSpy = sinon.spy (store, 'dispatchMatchSequence')
      const { dispatchMatchSequence } = store
      await dispatchMatchSequence ({ type: 'action1' }, ['action2', 'action3'])
      await dispatchMatchSequence ({ type: 'action4' }, ['action5'])
    }

    // then
    // ... should fail with the expected error
    await t.rejects (() => SUT.reduxFlow ({ createRootReducer, middleware }, callback), MatchSequencePartialMatchError)
    // ... having only waited for the first sequence of actions
    // ... not the second
    t.same (dispatchMatchSequenceSpy.args, [
      [{ type: 'action1' }, ['action2', 'action3']],
    ])
    t.end ()
  })

  t.test ('reduxFlow : dispatchMatchSequence : failure using matchSequenceThrow (partial match during second sequence)', async (t) => {
    // given
    // ... a create root reducer function
    // ... and middleware that dispatches a action2 then action2 on action1
    // ... and middleware that dispatches action5 on action4
    const stateA = createReducer (null, {})
    const createRootReducer = () => combineReducers ({ stateA })
    const middleware1 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action1') {
        dispatch ({ type: 'action2' })
        dispatch ({ type: 'action3' })
      }
    }
    const middleware2 = ({ dispatch }) => next => action => {
      next (action)
      const { type } = action
      if (type === 'action4') {
        dispatch ({ type: 'action5' })
      }
    }
    const middleware = [middleware1, middleware2]

    // when
    // ... we use the provided dispatchMatchSequence in our callback to wait for
    // ... and gather a list of actions that will occur in response
    // ... to each of our callback's dispatches
    // ... but not all of the second sequence's expectations are matched (action 6 never happens, and dispatchMatchSequence times out)
    let dispatchMatchSequenceSpy
    const callback = async (store) => {
      dispatchMatchSequenceSpy = sinon.spy (store, 'dispatchMatchSequence')
      const { dispatchMatchSequence } = store
      await dispatchMatchSequence ({ type: 'action1' }, ['action2', 'action3'])
      await dispatchMatchSequence ({ type: 'action4' }, ['action5', 'action6'])
    }

    // then
    // ... should fail with the expected error
    await t.rejects (() => SUT.reduxFlow ({ createRootReducer, middleware }, callback), MatchSequencePartialMatchError)
    // ... having waited for all expected action sequences
    t.same (dispatchMatchSequenceSpy.args, [
      [{ type: 'action1' }, ['action2', 'action3']],
      [{ type: 'action4' }, ['action5', 'action6']],
    ])
    t.end ()
  })
  t.end ()
})
