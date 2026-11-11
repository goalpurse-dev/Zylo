// M3: the 40 benchmark topics (the any-topic plan of 2026-11-04) and their saved plans (m3/sweep/plans), by category.
// Shared by scoreboard.mjs and storyScore.mjs.
export const BENCH = [
  ["Swimming pool", "Yard, house & water", ["swimming_pool"]], ["Toilet", "Yard, house & water", ["toilet"]],
  ["Road", "Yard, house & water", ["road"]], ["Septic tank", "Yard, house & water", ["septic_tank"]], ["Roof", "Yard, house & water", ["roof"]],
  ["Water well", "Yard, house & water", ["to_build_a_water_well"]], ["Pond", "Yard, house & water", ["backyard_pond", "garden_pond"]],
  ["Garden shelter", "Yard, house & water", ["garden_shelter"]], ["Gas station tank", "Yard, house & water", ["gas_station_tank"]], ["Traffic light", "Yard, house & water", ["traffic_light"]],
  ["Sewage treatment plant", "Utilities & energy", ["sewage_treatment_plant"]], ["Electricity to your outlet", "Utilities & energy", ["electricity_to_outlet"]], ["Nuclear power plant", "Utilities & energy", ["nuclear_power_plant"]],
  ["Stove", "Appliances", ["real_stove_rerun", "real_stove_first", "gas_stove", "cuisiniere"]], ["Washing machine", "Appliances", ["washing_machine", "real_washer", "hand_washer"]],
  ["Fridge", "Appliances", ["fridge"]], ["Air conditioner", "Appliances", ["air_conditioner"]], ["Water heater / shower", "Appliances", ["water_heater"]], ["Microwave", "Appliances", ["microwave"]],
  ["Four-wheel steering", "Vehicles & engines", ["four_wheel_steering_turns_a_giant_car_li", "kitplan_steering"]],
  ["Air suspension", "Vehicles & engines", ["air_suspension_bagged_cars_works_the_sim", "kitplan_air_saved"]],
  ["Car engine", "Vehicles & engines", ["hand_engine"]], ["Car brakes", "Vehicles & engines", ["car_brakes"]], ["Airplane", "Vehicles & engines", ["airplane"]], ["Submarine", "Vehicles & engines", ["submarine"]],
  ["Chainsaw clutch", "Machines & tools", ["chainsaw_clutch_stops_you_from_dying", "kitplan_chainsaw"]], ["Elevator", "Machines & tools", ["whow_an_elevator_works"]], ["Escalator", "Machines & tools", ["escalator"]],
  ["Skyscraper", "Buildings & bridges", ["to_build_a_skyscraper"]], ["Nuclear bunker", "Buildings & bridges", ["real_bunker_rerun", "nuclear_bunker"]],
  ["Arch bridge", "Buildings & bridges", ["ancient_bridge", "bridge"]], ["Suspension bridge", "Buildings & bridges", ["suspension_bridge"]], ["Dam", "Buildings & bridges", ["dam"]],
  ["Tunnel under a river", "Buildings & bridges", ["tunnel_under_river"]], ["Lighthouse", "Buildings & bridges", ["lighthouse"]],
  ["Smoke detector", "Electronics & factories", ["smoke_detector"]], ["Chip factory", "Electronics & factories", ["puddle_of_mud_can_become_a_semiconductor"]],
  ["Volcano", "Body, animals & nature", ["volcano"]], ["Heart stent", "Body, animals & nature", ["heart_stent"]], ["Fish", "Body, animals & nature", ["fish"]],
].map(([name, cat, plans]) => ({ name, cat, plans }));
if (BENCH.length !== 40) throw new Error(`need 40 topics, have ${BENCH.length}`);
