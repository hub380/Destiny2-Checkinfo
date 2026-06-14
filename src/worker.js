import { handleAppRequest } from './app-core.js';

export default {
  fetch(request, env, ctx) {
    return handleAppRequest(request, env, ctx, {
      assetsFetch: (assetRequest) => env.ASSETS.fetch(assetRequest)
    });
  }
};
