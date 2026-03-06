import {all, fork} from 'redux-saga/effects';
import {authSaga} from './authSaga';
import {farmSaga} from './farmSaga';
import {syncSaga} from './syncSaga';

// Root saga that combines all sagas
export function* rootSaga() {
  yield all([
    fork(authSaga),
    fork(farmSaga),
    fork(syncSaga),
    // Additional sagas will be added here as features are implemented
  ]);
}
