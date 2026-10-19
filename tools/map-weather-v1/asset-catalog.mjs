/** Reusable weather fixtures; coordinates agree with the local weather test simulation. */
export const WEATHER_ASSET_CATALOG = Object.freeze([
  { id:'cloud', name_ko:'구름 은폐 · 햇살 이불구름', center:[-45,8,-24], role:'겹겹의 구름 속에서 시야와 표적 노출을 확인', reused:['sunlit-cloud'], original_fixture:false },
  { id:'updraft', name_ko:'상승기류 · 나선 바람기둥', center:[0,8,-24], role:'빈 중심을 남긴 민트빛 상승 흐름과 떠오르는 씨앗', reused:['rising-cloud'], original_fixture:true },
  { id:'crosswind', name_ko:'횡풍 · 봉제 바람자루 관측대', center:[45,8,-24], role:'나무 관측대의 산호색 바람자루와 +Z 방향 흐름', reused:['mist-ribbons'], original_fixture:true },
  { id:'lightning', name_ko:'낙뢰 예고 · 먹구름 관측소', center:[-45,8,24], role:'경고에 모이는 먹구름과 고정된 예상 낙뢰 위치로 내려오는 번개', reused:['storm-front'], original_fixture:true },
  { id:'icing', name_ko:'착빙과 예열 · 서리 풍차와 온기 화로', center:[0,8,24], role:'늘어진 고드름·서리 배관·느려지는 풍차와 예열용 화로', reused:[], original_fixture:true },
  { id:'thermal', name_ko:'열풍 통로 · 삼연식 증기 성벽', center:[45,8,24], role:'세 통로 중 한 곳의 압력 예고와 가로지르는 주황 열풍', reused:[], original_fixture:true },
]);

export const WEATHER_ASSET_LIMITS = Object.freeze({
  format:'Runtime THREE.Group assets with real geometry; static snapshots can be exported centrally.',
  reusedCloudAssets:4,
  newCloudAssetCount:0,
  originalFixtureAssemblies:5,
  art:'Original Cloudstitch warm handmade fantasy; cream cloth, honey wood, teal enamel, brass and coral patches. Latest direction: 10x bolder dramatic presence through distinct large forms, material layers and anticipation/release/afterglow rhythm, not a numeric scale or damage multiplier.',
  motion:'Procedural mesh/group deformation and timed layers; no fluid, skeletal cloth or particle-engine simulation.',
  gameplay:'The separate simulation owns collision, drift, damage, icing and heat. Visual mesh count never changes gameplay rules.',
  scope:'Local weather test course; no campaign, save migration, production colliders, LODs or approved performance budget.',
});

export const WEATHER_EXPRESSION_PROFILES = Object.freeze({
  standard:{id:'standard',revision:'weather-art-source1',purpose:'Preserved first-profile shapes and timing for matching-camera/event comparison.'},
  dramatic:{id:'dramatic',revision:'weather-art-source2-dramatic',default:true,direction:'Latest 2026-10-18 user instruction: 10x bolder, more dramatic and abundant expression; no gameplay multiplier.',layers:{
    cloud:'Sweeping entry veils around the reused cloud bank; the flight corridor remains readable.',
    updraft:'Three distinct stages: broad low inlet curls, rising helical body, petal-shaped top outflow and dispersing seeds.',
    crosswind:'The sock first bends against the coming gust; long tapered cloth flows race through, then the sock rebounds and settles.',
    lightning:'Separated charge strands converge toward the fixed warning target, split into striking forks, and leave pale rising afterglow.',
    icing:'Large jagged crystal fans plus fine sugar frost on an engine housing; preheating releases separate steam curls and ballistic sparks.',
    thermal:'Pressure pulses and nozzle breaths precede a thick tapered brush stream; side scrolls curl upward and grey residual vapor outlives the burst.',
  }},
});
