import { pieConfig } from '../config/pie'

import { deepClone } from '@jiaminghi/c-render/lib/util'

import { deepMerge, mulAdd } from '../util'

export function pie (chart, option = {}) {
  const { series } = option

  if (!series) removePies(chart)

  initChartPie(chart)

  let pies = series.filter(({ type }) => type === 'pie')

  if (!pies.length) return removePies(chart)

  pies = mergePieDefaultConfig(pies)

  pies = calcPiesCenter(pies, chart)

  pies = calcPiesRadius(pies, chart)

  pies = calcRosePiesRadius(pies, chart)

  pies = calcPiesPercent(pies)

  pies = calcPiesAngle(pies, chart)

  delRedundancePies(pies, chart)

  updatePies(pies, chart)

  console.warn(pies)
}

function removePies (chart) {
  const { pie, render } = chart

  if (pie) pie.forEach(pieItem => pieItem.forEach(g => render.delGraph(g)))
}

function initChartPie (chart) {
  const { pie } = chart

  if (!pie) chart.pie = []
}

function mergePieDefaultConfig (pies) {
  return pies.map(pieItem => deepMerge(deepClone(pieConfig, true), pieItem))
}

function calcPiesCenter(pies, chart) {
  const { area } = chart.render

  pies.forEach(pie => {
    let { center } = pie

    center = center.map((pos, i) => {
      if (typeof pos === 'number') return pos

      return parseInt(pos) / 100 * area[i]
    })

    pie.center = center
  })

  return pies
}

function calcPiesRadius (pies, chart) {
  const maxRadius = Math.min(...chart.render.area) / 2

  pies.forEach(pie => {
    let { radius, data } = pie

    radius = getNumberRadius(radius, maxRadius)

    data.forEach(item => {
      let { radius: itemRadius } = item

      if (!itemRadius) itemRadius = radius

      itemRadius = getNumberRadius(itemRadius, maxRadius)

      item.radius = itemRadius
    })

    pie.radius = radius
  })

  return pies
}

function getNumberRadius (radius, maxRadius) {
  if (!(radius instanceof Array)) radius = [0, radius]

  radius = radius.map(r => {
    if (typeof r === 'number') return r

    return parseInt(r) / 100 * maxRadius
  })

  return radius
}

function calcRosePiesRadius (pies, chart) {
  const rosePie = pies.filter(({ roseType }) => roseType)

  rosePie.forEach(pie => {
    let { radius, data } = pie

    const roseIncrement = getRoseIncrement(pie)

    data = sortData(data)

    data.forEach((item, i) => {
      item.radius[1] = radius[1] - roseIncrement * i
    })

    data.reverse()

    pie.roseIncrement = roseIncrement
  })

  return pies
}

function sortData (data) {
  return data.sort(({ value: a }, { value: b }) => {
    if (a === b) return 0
    if (a > b) return -1
    if (a < b) return 1
  })
}

function getRoseIncrement (pie) {
  const { radius, roseIncrement } = pie

  if (typeof roseIncrement === 'number') return roseIncrement

  return parseInt(roseIncrement) / 100 * radius[1]
}

function calcPiesPercent (pies) {
  pies.forEach(pie => {
    const { data, percentToFixed } = pie

    const sum = getDataSum(data)

    data.forEach(item => {
      const { value } = item

      item.percent = parseFloat((value / sum * 100).toFixed(percentToFixed))
    })

    const percentSumNoLast = mulAdd(data.slice(0, -1).map(({ percent }) => percent))

    data.slice(-1)[0].percent = 100 - percentSumNoLast
  })

  return pies
}

function getDataSum (data) {
  return mulAdd(data.map(({ value }) => value))
}

function calcPiesAngle (pies) {
  pies.forEach(pie => {
    const { startAngle: start, data } = pie

    data.forEach((item, i) => {
      const [startAngle, endAngle] = getDataAngle(data, i)

      item.startAngle = start + startAngle
      item.endAngle = start + endAngle
    })
  })

  return pies
}

function getDataAngle (data, i) {
  const fullAngle = Math.PI * 2

  const needAddData = data.slice(0, i + 1)

  const percentSum = mulAdd(needAddData.map(({ percent }) => percent))

  const { percent } = data[i]

  const startPercent = percentSum - percent

  return [fullAngle * startPercent / 100, fullAngle * percentSum / 100]
}

function delRedundancePies (pies, chart) {
  const { pie, render } = chart

  const PiesNum = pies.length
  const cacheNum = pie.length

  if (cacheNum > PiesNum) {
    const needDelPies = pie.splice(PiesNum)

    needDelPies.forEach(pieItem => pieItem.forEach(g => render.delGraph(g)))
  }
}

function updatePies (pies, chart) {
  const { render, pie: pieCache } = chart

  pies.forEach((pieItem, i) => {
    let cache = pieCache[i]

    if (cache) {
      changePies(cache, pieItem, render)
    } else {
      addNewPies(pieCache, pieItem, i, render)
    }
  })
}

function changePies () {

}

function addNewPies (pieCache, pieItem, i, render) {
  const { show, pieStyle, data, center } = pieItem

  const { animationCurve, animationFrame } = pieItem

  const graphs = data.map((item, i) => {
    const { radius, startAngle, endAngle } = item

    const style = mergePieColor(pieStyle, item)

    return render.add({
      name: 'pie',
      visible: show,
      animationCurve,
      shape: {
        startAngle,
        endAngle,
        ir: radius[0],
        or: radius[0],
        rx: center[0],
        ry: center[1]
      },
      style
    })
  })

  graphs.forEach((graph, i) => {
    graph.animation('shape', { or: data[i].radius[1] }, true)
  })

  pieCache[i] = graphs
}

function mergePieColor (pieStyle, dataItem) {
  const { color } = dataItem

  return deepMerge({ fill: color }, pieStyle)
}