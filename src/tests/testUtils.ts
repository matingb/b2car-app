"use client";

import { act } from "@testing-library/react";

/**
 * Útil para evitar `waitFor` cuando las actualizaciones son sincrónicas
 * pero React aplica el re-render de forma async.
 */
export const runPendingPromises = async () => act(async () => {});


