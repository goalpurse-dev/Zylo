// Node tests exercise browser models without loading their static images.
export async function load(url, context, nextLoad) {
  if (/\.(png|jpe?g|webp|svg)$/.test(url)) return {format:'module',source:`export default ${JSON.stringify(url)};`,shortCircuit:true};
  return nextLoad(url,context);
}
