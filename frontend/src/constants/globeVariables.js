export const GLOBE_VARIABLE_OPTIONS = [
  { id: 'o3col', zh: '臭氧柱浓度', en: 'Ozone Column', unitType: 'ozone' },
  { id: 'Temperature', zh: '温度', en: 'Temperature', unitType: 'temperature' },
  { id: 'Solar_Flux_DN', zh: '太阳下行辐射', en: 'Solar Downwelling Flux', unitType: 'flux' },
  { id: 'U_Wind', zh: '纬向风 U', en: 'U Wind', unitType: 'wind' },
  { id: 'V_Wind', zh: '经向风 V', en: 'V Wind', unitType: 'wind' },
];

export function getGlobeVariableMeta(variableId = 'o3col') {
  return GLOBE_VARIABLE_OPTIONS.find((item) => item.id === variableId) || GLOBE_VARIABLE_OPTIONS[0];
}

