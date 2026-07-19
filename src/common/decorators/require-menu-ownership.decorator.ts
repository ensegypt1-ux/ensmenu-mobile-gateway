import { SetMetadata } from '@nestjs/common';

/** Mark a GET handler that must verify `:menuId` ownership before proxying. */
export const REQUIRE_MENU_OWNERSHIP_KEY = 'requireMenuOwnership';

export const RequireMenuOwnership = () =>
  SetMetadata(REQUIRE_MENU_OWNERSHIP_KEY, true);
