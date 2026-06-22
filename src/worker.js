import { handleAppRequest, handleScheduled } from './app-core.js';

export default {
  fetch(request, env, ctx) {
    return handleAppRequest(request, env, ctx, {
      assetsFetch: (assetRequest) => env.ASSETS.fetch(assetRequest)
    });
  },
  scheduled(controller, env, ctx) {
    return handleScheduled(controller, env, ctx);
  }
};
