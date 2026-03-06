import {store, authActions, farmActions, syncActions} from '../index';

describe('Redux Store', () => {
  it('should initialize with correct initial state', () => {
    const state = store.getState();

    // Check auth slice
    expect(state.auth.isAuthenticated).toBe(false);
    expect(state.auth.token).toBeNull();
    expect(state.auth.language).toBe('hi');

    // Check farm slice
    expect(state.farm.farms).toEqual([]);
    expect(state.farm.selectedFarmId).toBeNull();

    // Check sync slice
    expect(state.sync.queue).toEqual([]);
    expect(state.sync.isSyncing).toBe(false);
    expect(state.sync.isOnline).toBe(true);
  });

  it('should handle auth login action', () => {
    store.dispatch(
      authActions.loginSuccess({
        token: 'test-token',
        userId: 'user-123',
        phone: '+919876543210',
        name: 'Test Farmer',
        language: 'hi',
      }),
    );

    const state = store.getState();
    expect(state.auth.isAuthenticated).toBe(true);
    expect(state.auth.token).toBe('test-token');
    expect(state.auth.userId).toBe('user-123');
    expect(state.auth.phone).toBe('+919876543210');
    expect(state.auth.name).toBe('Test Farmer');
  });

  it('should handle auth logout action', () => {
    store.dispatch(authActions.logout());

    const state = store.getState();
    expect(state.auth.isAuthenticated).toBe(false);
    expect(state.auth.token).toBeNull();
    expect(state.auth.userId).toBeNull();
  });

  it('should handle farm data', () => {
    const mockFarms = [
      {
        id: 'farm-1',
        userId: 'user-123',
        location: {latitude: 19.076, longitude: 72.8777},
        sizeHectares: 2.5,
        soilType: 'Black',
        irrigationType: 'Drip',
        createdAt: new Date().toISOString(),
      },
    ];

    store.dispatch(farmActions.fetchFarmsSuccess(mockFarms));

    const state = store.getState();
    expect(state.farm.farms).toHaveLength(1);
    expect(state.farm.farms[0].id).toBe('farm-1');
    expect(state.farm.selectedFarmId).toBe('farm-1'); // Auto-selected
  });

  it('should handle sync queue operations', () => {
    store.dispatch(
      syncActions.addToSyncQueue({
        action: 'CREATE_DISEASE_DETECTION',
        payload: {cropId: 'crop-1', imageUrl: 'test.jpg'},
        priority: 'HIGH',
      }),
    );

    const state = store.getState();
    expect(state.sync.queue).toHaveLength(1);
    expect(state.sync.queue[0].action).toBe('CREATE_DISEASE_DETECTION');
    expect(state.sync.queue[0].priority).toBe('HIGH');
    expect(state.sync.queue[0].status).toBe('PENDING');
    expect(state.sync.pendingCount).toBe(1);
  });

  it('should maintain type safety with typed hooks', () => {
    // This test verifies TypeScript compilation
    // If types are incorrect, this won't compile
    const state = store.getState();
    
    // These should all be properly typed
    const isAuth: boolean = state.auth.isAuthenticated;
    const token: string | null = state.auth.token;
    const farms = state.farm.farms;
    const syncQueue = state.sync.queue;

    expect(typeof isAuth).toBe('boolean');
    expect(Array.isArray(farms)).toBe(true);
    expect(Array.isArray(syncQueue)).toBe(true);
  });
});
