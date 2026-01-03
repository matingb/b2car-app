export const getIvaRate = () => {
  const rateEnv = process.env.IVA_RATE; // e.g., 0.21
  const percentEnv = process.env.IVA_PERCENT; // e.g., 21
  let rate = 0.21;
  if (
    rateEnv &&
    !Number.isNaN(Number(rateEnv)) &&
    Number(rateEnv) >= 0 &&
    Number(rateEnv) < 1
  ) {
    rate = Number(rateEnv);
  } else if (
    percentEnv &&
    !Number.isNaN(Number(percentEnv)) &&
    Number(percentEnv) >= 0
  ) {
    rate = Number(percentEnv) / 100;
  }
  return rate;
};

export const IVA_RATE = getIvaRate();


