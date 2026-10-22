import { styleText } from "node:util";

const dosage = 325
const halfDosage = dosage / 2
const oneHalfDosage = dosage + halfDosage
const doubleDosage = dosage + dosage
const none = 0

const halfTimeHours = 36

const formatter = new Intl.NumberFormat('en-us', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dayName = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
]
export const dosageByDays = [
  // w1
  halfDosage, // mon
  halfDosage, // tue
  dosage, // wed
  dosage, // thu
  dosage, // fri
  dosage, // sat
  dosage, // sun,


  // w2
  oneHalfDosage, // mon
  oneHalfDosage, // tue
  oneHalfDosage, // wed
  oneHalfDosage, // thu
  oneHalfDosage, // fri
  none, // sat
  oneHalfDosage, // sun

  // w3
  none, // wed
  none, // wed
  none, // wed
  none, // wed
  none, // wed
  none, // wed
  none, // wed

  none, // wed
  none, // wed
  none, // wed
  none, // wed
  none, // wed
  none, // wed
  none, // wed

  none, // wed
  none, // wed
]

function remainingAt(dosage: number, halfTimeHours: number, dayNumber: number) {
  const elapsedHours = dayNumber * 24
  const nHalfTimes = elapsedHours / halfTimeHours
  return dosage * Math.pow(0.5, nHalfTimes)
}

const remainsByDosage = dosageByDays.map((dosage, index, arr) => {
  const remains = Array.from({ length: arr.length }).map(() => 0)
  for (let i = index; i < remains.length; i++) {
    const dayNumber = i - index
    const remain = remainingAt(dosage, halfTimeHours, dayNumber)
    remains[i] = remain
  }
  return remains
})

const remainsTotal = remainsByDosage.reduce((a, b) => {
  for (let i = 0; i < dosageByDays.length; i++) {
    a[i] += b[i]
  }
  return a
}, Array.from({ length: dosageByDays.length }).map(() => 0))

for (let i = 0; i < remainsTotal.length; i++) {
  if (i % 7 === 0) {
    console.log()
    console.log("==")
    console.log()
  }
  const day = dayName[i % 7]
  const dayNumber = i + 1
  console.log(`${day} (day ${dayNumber}):\t`, styleText("yellow", formatter.format(remainsTotal[i]).padStart(8, ' ')), 'mg')
}

const totalCaps = dosageByDays.reduce((a, b) => a + b, 0) / dosage
console.log("")
console.log("Total consumed:", totalCaps, "caps")