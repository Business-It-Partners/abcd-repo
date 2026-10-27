//#region src/calendar-data.ts
/**
* Bikram Sambat (BS) month-length table — the single source of truth for all
* BS↔AD conversion. Row format: 12 month lengths followed by the year total.
*
* Coverage: BS 1970–2099 (AD 1913–2043). Verified against the official BS
* new-year dates for 2000, 2050, 2070, 2075 and 2080–2084; the whole
* 1970–2083 range is weekday-chain consistent with the AD calendar from the
* anchor BS 1970-01-01 = AD 1913-04-13. Years beyond ~2085 are projections
* (the official Nepali calendar is only published a year or two ahead), kept
* for UI range purposes.
*
* Do **not** hand-edit a single month without running `yarn test` — the
* table-integrity test guards every row, and an off-by-one in any month
* shifts every conversion after it.
*
* @example
* CALENDAR_DATA[2081] // → [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31, 366]
* CALENDAR_DATA[2081][1] // → 32 (Jestha 2081 has 32 days)
*/
const CALENDAR_DATA = {
	1970: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1971: [
		31,
		31,
		32,
		31,
		32,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1972: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	1973: [
		30,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		365
	],
	1974: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1975: [
		31,
		31,
		32,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1976: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	1977: [
		30,
		32,
		31,
		32,
		31,
		31,
		29,
		30,
		30,
		29,
		29,
		31,
		365
	],
	1978: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1979: [
		31,
		31,
		32,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1980: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	1981: [
		31,
		31,
		31,
		32,
		31,
		31,
		29,
		30,
		30,
		29,
		30,
		30,
		365
	],
	1982: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1983: [
		31,
		31,
		32,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1984: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	1985: [
		31,
		31,
		31,
		32,
		31,
		31,
		29,
		30,
		30,
		29,
		30,
		30,
		365
	],
	1986: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1987: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1988: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	1989: [
		31,
		31,
		31,
		32,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1990: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1991: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		30,
		365
	],
	1992: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		366
	],
	1993: [
		31,
		31,
		31,
		32,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1994: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1995: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		30,
		365
	],
	1996: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		366
	],
	1997: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1998: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	1999: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2e3: [
		30,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		365
	],
	2001: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2002: [
		31,
		31,
		32,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2003: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2004: [
		30,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		365
	],
	2005: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2006: [
		31,
		31,
		32,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2007: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2008: [
		31,
		31,
		31,
		32,
		31,
		31,
		29,
		30,
		30,
		29,
		29,
		31,
		365
	],
	2009: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2010: [
		31,
		31,
		32,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2011: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2012: [
		31,
		31,
		31,
		32,
		31,
		31,
		29,
		30,
		30,
		29,
		30,
		30,
		365
	],
	2013: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2014: [
		31,
		31,
		32,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2015: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2016: [
		31,
		31,
		31,
		32,
		31,
		31,
		29,
		30,
		30,
		29,
		30,
		30,
		365
	],
	2017: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2018: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2019: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		366
	],
	2020: [
		31,
		31,
		31,
		32,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2021: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2022: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		30,
		365
	],
	2023: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		366
	],
	2024: [
		31,
		31,
		31,
		32,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2025: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2026: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2027: [
		30,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		365
	],
	2028: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2029: [
		31,
		31,
		32,
		31,
		32,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2030: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2031: [
		30,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		365
	],
	2032: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2033: [
		31,
		31,
		32,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2034: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2035: [
		30,
		32,
		31,
		32,
		31,
		31,
		29,
		30,
		30,
		29,
		29,
		31,
		365
	],
	2036: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2037: [
		31,
		31,
		32,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2038: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2039: [
		31,
		31,
		31,
		32,
		31,
		31,
		29,
		30,
		30,
		29,
		30,
		30,
		365
	],
	2040: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2041: [
		31,
		31,
		32,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2042: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2043: [
		31,
		31,
		31,
		32,
		31,
		31,
		29,
		30,
		30,
		29,
		30,
		30,
		365
	],
	2044: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2045: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2046: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2047: [
		31,
		31,
		31,
		32,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2048: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2049: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		30,
		365
	],
	2050: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		366
	],
	2051: [
		31,
		31,
		31,
		32,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2052: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2053: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		30,
		365
	],
	2054: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		366
	],
	2055: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2056: [
		31,
		31,
		32,
		31,
		32,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2057: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2058: [
		30,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		365
	],
	2059: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2060: [
		31,
		31,
		32,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2061: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2062: [
		30,
		32,
		31,
		32,
		31,
		31,
		29,
		30,
		29,
		30,
		29,
		31,
		365
	],
	2063: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2064: [
		31,
		31,
		32,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2065: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2066: [
		31,
		31,
		31,
		32,
		31,
		31,
		29,
		30,
		30,
		29,
		29,
		31,
		365
	],
	2067: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2068: [
		31,
		31,
		32,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2069: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2070: [
		31,
		31,
		31,
		32,
		31,
		31,
		29,
		30,
		30,
		29,
		30,
		30,
		365
	],
	2071: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2072: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2073: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		31,
		366
	],
	2074: [
		31,
		31,
		31,
		32,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2075: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2076: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		30,
		365
	],
	2077: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		366
	],
	2078: [
		31,
		31,
		31,
		32,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2079: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2080: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		29,
		30,
		30,
		365
	],
	2081: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		29,
		31,
		366
	],
	2082: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2083: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		29,
		30,
		30,
		365
	],
	2084: [
		31,
		31,
		32,
		31,
		31,
		30,
		30,
		30,
		29,
		30,
		30,
		30,
		365
	],
	2085: [
		31,
		32,
		31,
		32,
		30,
		31,
		30,
		30,
		29,
		30,
		30,
		30,
		366
	],
	2086: [
		30,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		30,
		30,
		365
	],
	2087: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		30,
		29,
		30,
		30,
		30,
		366
	],
	2088: [
		30,
		31,
		32,
		32,
		30,
		31,
		30,
		30,
		29,
		30,
		30,
		30,
		365
	],
	2089: [
		30,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		30,
		30,
		365
	],
	2090: [
		30,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		30,
		30,
		365
	],
	2091: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		30,
		29,
		30,
		30,
		30,
		366
	],
	2092: [
		30,
		31,
		32,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		30,
		30,
		365
	],
	2093: [
		30,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		30,
		30,
		365
	],
	2094: [
		31,
		31,
		32,
		31,
		31,
		30,
		30,
		30,
		29,
		30,
		30,
		30,
		365
	],
	2095: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		30,
		30,
		30,
		30,
		366
	],
	2096: [
		30,
		31,
		32,
		32,
		31,
		30,
		30,
		30,
		30,
		29,
		30,
		30,
		365
	],
	2097: [
		31,
		32,
		31,
		32,
		31,
		30,
		30,
		30,
		29,
		30,
		30,
		30,
		366
	],
	2098: [
		31,
		31,
		32,
		31,
		31,
		31,
		29,
		30,
		29,
		30,
		29,
		31,
		365
	],
	2099: [
		31,
		31,
		32,
		31,
		31,
		31,
		30,
		29,
		29,
		30,
		30,
		30,
		365
	]
};
/** Two-letter weekday labels (0 = Sunday) — what the datepicker grids' header row shows. */
const NEPALI_DAYS = [
	"Su",
	"Mo",
	"Tu",
	"We",
	"Th",
	"Fr",
	"Sa"
];
/** Romanized BS month names (index 0 = Baishakh) — what the datepicker headers display. */
const NEPALI_MONTHS = [
	"Baishakh",
	"Jestha",
	"Ashadh",
	"Shrawan",
	"Bhadra",
	"Ashwin",
	"Kartik",
	"Mangsir",
	"Poush",
	"Magh",
	"Falgun",
	"Chaitra"
];
/**
* Locale tables for `NepaliDate.format()` — month/weekday names and digits per
* language (`en`, `np`). The `np` strings match what the replaced
* nepali-date-converter library produced, so formatted output is unchanged.
*/
const LOCALE = {
	en: {
		dayShort: [
			"Sun",
			"Mon",
			"Tue",
			"Wed",
			"Thu",
			"Fri",
			"Sat"
		],
		dayLong: [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday"
		],
		monthShort: [
			"Bai",
			"Jes",
			"Asa",
			"Shr",
			"Bhd",
			"Asw",
			"Kar",
			"Man",
			"Pou",
			"Mag",
			"Fal",
			"Cha"
		],
		monthLong: [
			"Baisakh",
			"Jestha",
			"Asar",
			"Shrawan",
			"Bhadra",
			"Aswin",
			"Kartik",
			"Mangsir",
			"Poush",
			"Magh",
			"Falgun",
			"Chaitra"
		],
		digits: [
			"0",
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
			"7",
			"8",
			"9"
		]
	},
	np: {
		dayShort: [
			"आइत",
			"सोम",
			"मंगल",
			"बुध",
			"बिहि",
			"शुक्र",
			"शनि"
		],
		dayLong: [
			"आइतबार",
			"सोमबार",
			"मंगलबार",
			"बुधबार",
			"बिहिबार",
			"शुक्रबार",
			"शनिबार"
		],
		monthShort: [
			"बै",
			"जे",
			"अ",
			"श्रा",
			"भा",
			"आ",
			"का",
			"मं",
			"पौ",
			"मा",
			"फा",
			"चै"
		],
		monthLong: [
			"बैशाख",
			"जेठ",
			"असार",
			"श्रावण",
			"भाद्र",
			"आश्विन",
			"कार्तिक",
			"मंसिर",
			"पौष",
			"माघ",
			"फाल्गुण",
			"चैत्र"
		],
		digits: [
			"०",
			"१",
			"२",
			"३",
			"४",
			"५",
			"६",
			"७",
			"८",
			"९"
		]
	}
};
//#endregion
//#region src/nepali-date.ts
const MS_PER_DAY$1 = 864e5;
const BS_EPOCH_YEAR = 1970;
const AD_EPOCH_UTC = Date.UTC(1913, 3, 13);
const EPOCH_DAY_OF_WEEK = 0;
/** First BS year with calendar data (inclusive). UI year ranges should derive from these, not hardcode. */
const MIN_BS_YEAR = BS_EPOCH_YEAR;
/** Last BS year with calendar data (inclusive). Years near the end of the range are projections — see calendar-data.ts. */
const MAX_BS_YEAR = Math.max(...Object.keys(CALENDAR_DATA).map(Number));
const MIN_YEAR = MIN_BS_YEAR;
const MAX_YEAR = MAX_BS_YEAR;
const DAYS_BEFORE_YEAR = {};
let acc = 0;
for (let y = MIN_YEAR; y <= MAX_YEAR; y++) {
	DAYS_BEFORE_YEAR[y] = acc;
	for (let m = 0; m < 12; m++) acc += CALENDAR_DATA[y][m];
}
const TOTAL_DAYS = acc;
/**
* Weekday of the 1st of every BS month (0 = Sunday), as
* `{ bsYear: weekday[12] }`. Precomputed for calendar grids; always derived
* from CALENDAR_DATA, never hand-maintained.
*
* @example
* FIRST_DAY_OF_MONTH[2081][0] // → 6 (Baishakh 2081 starts on a Saturday)
*/
const FIRST_DAY_OF_MONTH = {};
for (let y = MIN_YEAR; y <= MAX_YEAR; y++) {
	let days = DAYS_BEFORE_YEAR[y];
	FIRST_DAY_OF_MONTH[y] = CALENDAR_DATA[y].slice(0, 12).map((len) => {
		const dow = (EPOCH_DAY_OF_WEEK + days) % 7;
		days += len;
		return dow;
	});
}
function rangeError(detail) {
	return /* @__PURE__ */ new Error(`NepaliDate: ${detail} — supported range is BS ${MIN_YEAR}-01-01 to ${MAX_YEAR}-12-${CALENDAR_DATA[MAX_YEAR][11]} (AD 1913-04-13 onwards)`);
}
/** Serial = whole days since BS 1970-01-01. Accepts out-of-range month/day and normalizes JS-Date-style. */
function bsToSerial(year, month0, day) {
	year += Math.floor(month0 / 12);
	month0 = (month0 % 12 + 12) % 12;
	if (!CALENDAR_DATA[year]) throw rangeError(`BS year ${year} is out of range`);
	let serial = DAYS_BEFORE_YEAR[year];
	for (let m = 0; m < month0; m++) serial += CALENDAR_DATA[year][m];
	serial += day - 1;
	if (serial < 0 || serial >= TOTAL_DAYS) throw rangeError(`BS ${year}-${month0 + 1}-${day} is out of range`);
	return serial;
}
function serialToBs(serial) {
	if (serial < 0 || serial >= TOTAL_DAYS) throw rangeError(`day offset ${serial} is out of range`);
	let year = MIN_YEAR;
	while (year < MAX_YEAR && serial >= DAYS_BEFORE_YEAR[year + 1]) year++;
	let rest = serial - DAYS_BEFORE_YEAR[year];
	let month0 = 0;
	while (rest >= CALENDAR_DATA[year][month0]) {
		rest -= CALENDAR_DATA[year][month0];
		month0++;
	}
	return {
		year,
		month: month0 + 1,
		day: rest + 1
	};
}
function adToSerial(adYear, adMonth0, adDay) {
	const serial = Math.round((Date.UTC(adYear, adMonth0, adDay) - AD_EPOCH_UTC) / MS_PER_DAY$1);
	if (serial < 0 || serial >= TOTAL_DAYS) throw rangeError(`AD ${adYear}-${adMonth0 + 1}-${adDay} is out of range`);
	return serial;
}
/**
* Converts a BS date (month **1-indexed**) to an AD `Date` at local midnight.
* Throws when the date is outside BS 1970–2099.
*
* @example
* bsToAd(2081, 1, 1) // → Date: Sat Apr 13 2024 (BS new year 2081)
*/
function bsToAd(year, month, day) {
	const d = new Date(AD_EPOCH_UTC + bsToSerial(year, month - 1, day) * MS_PER_DAY$1);
	return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
/**
* Converts an AD `Date` (read in local time) to BS parts (month **1-indexed**).
* Throws when the date falls before AD 1913-04-13 or past the calendar table.
*
* @example
* adToBs(new Date(2024, 3, 13)) // → { year: 2081, month: 1, day: 1 }
*/
function adToBs(date) {
	return serialToBs(adToSerial(date.getFullYear(), date.getMonth(), date.getDate()));
}
/**
* Drop-in replacement for the `nepali-date-converter` default export, backed
* by CALENDAR_DATA instead of the library's (internally inconsistent) tables.
* Date-only: time-of-day is intentionally not carried.
*
* Matches the library's API shape: `getMonth()` is 0-indexed, constructor
* accepts (), (Date), (NepaliDate) or (bsYear, bsMonth0, bsDay) with
* JS-Date-style rollover (day 0 = last day of previous month, etc.).
*
* @example
* const d = new NepaliDate(2081, 0, 15);    // BS 2081 Baishakh 15 — month is 0-INDEXED
* d.format("YYYY-MM-DD");                   // → "2081-01-15"
* new NepaliDate();                         // today
* NepaliDate.fromAD(new Date(2024, 3, 13)); // → BS 2081-01-01
*/
var NepaliDate = class NepaliDate {
	constructor(yearOrSource, month0, day) {
		if (yearOrSource instanceof NepaliDate) this.serial = yearOrSource.serial;
		else if (yearOrSource instanceof Date) this.serial = adToSerial(yearOrSource.getFullYear(), yearOrSource.getMonth(), yearOrSource.getDate());
		else if (typeof yearOrSource === "number") this.serial = bsToSerial(yearOrSource, month0 ?? 0, day ?? 1);
		else {
			const now = /* @__PURE__ */ new Date();
			this.serial = adToSerial(now.getFullYear(), now.getMonth(), now.getDate());
		}
		this.parts = serialToBs(this.serial);
	}
	/**
	* Builds a NepaliDate from an AD `Date` (read in local time).
	*
	* @example
	* NepaliDate.fromAD(new Date(2024, 3, 13)) // → BS 2081-01-01
	*/
	static fromAD(date) {
		return new NepaliDate(date);
	}
	/** BS year, e.g. 2081. */
	getYear() {
		return this.parts.year;
	}
	/**
	* BS month, **0-indexed** like the replaced library (0 = Baishakh).
	*
	* @example
	* new NepaliDate(2081, 0, 15).getMonth() // → 0 (Baishakh)
	*/
	getMonth() {
		return this.parts.month - 1;
	}
	/** Day of month, 1-indexed. */
	getDate() {
		return this.parts.day;
	}
	/**
	* Weekday, 0 = Sunday.
	*
	* @example
	* new NepaliDate(2081, 0, 1).getDay() // → 6 (BS new year 2081 was a Saturday)
	*/
	getDay() {
		return (EPOCH_DAY_OF_WEEK + this.serial) % 7;
	}
	/**
	* Sets the BS year, keeping month and day (mutates in place).
	* Throws when the result leaves the calendar table.
	*
	* @example
	* const d = new NepaliDate(2081, 0, 15);
	* d.setYear(2082); // d is now BS 2082-01-15
	*/
	setYear(year) {
		this.reset(year, this.parts.month - 1, this.parts.day);
	}
	/**
	* Sets the BS month (**0-indexed**, mutates in place) with JS-Date-style
	* rollover.
	*
	* @example
	* const d = new NepaliDate(2081, 0, 15);
	* d.setMonth(12); // rolls over → BS 2082-01-15
	*/
	setMonth(month0) {
		this.reset(this.parts.year, month0, this.parts.day);
	}
	/**
	* Sets the day of month (mutates in place) with JS-Date-style rollover.
	*
	* @example
	* const d = new NepaliDate(2081, 0, 1);
	* d.setDate(0); // → last day of the previous month (Chaitra 2080)
	*/
	setDate(day) {
		this.reset(this.parts.year, this.parts.month - 1, day);
	}
	/**
	* The AD equivalent as a JS `Date` at local midnight.
	*
	* @example
	* new NepaliDate(2081, 0, 1).toJsDate() // → Date: Sat Apr 13 2024
	*/
	toJsDate() {
		const d = new Date(AD_EPOCH_UTC + this.serial * MS_PER_DAY$1);
		return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
	}
	/**
	* Formats with dayjs-style tokens: YYYY YY MMMM MMM MM M DD D dddd ddd dd d.
	* `language` "np" renders Devanagari digits and names.
	*
	* @example
	* const d = new NepaliDate(2081, 2, 5);
	* d.format("dddd, MMMM D");     // → "Wednesday, Asar 5"
	* d.format("YYYY-MM-DD", "np"); // → "२०८१-०३-०५"
	*/
	format(pattern, language = "en") {
		const loc = LOCALE[language];
		const num = (value, pad) => String(value).padStart(pad, "0").replace(/\d/g, (ch) => loc.digits[Number(ch)]);
		return pattern.replace(/YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|dd|d/g, (token) => {
			switch (token) {
				case "YYYY": return num(this.parts.year, 4);
				case "YY": return num(this.parts.year % 100, 2);
				case "MMMM": return loc.monthLong[this.parts.month - 1];
				case "MMM": return loc.monthShort[this.parts.month - 1];
				case "MM": return num(this.parts.month, 2);
				case "M": return num(this.parts.month, 1);
				case "DD": return num(this.parts.day, 2);
				case "D": return num(this.parts.day, 1);
				case "dddd": return loc.dayLong[this.getDay()];
				case "ddd":
				case "dd": return loc.dayShort[this.getDay()];
				default: return num(this.getDay(), 1);
			}
		});
	}
	/**
	* Zero-padded "YYYY-MM-DD" — this library's canonical string format.
	*
	* @example
	* new NepaliDate(2081, 0, 15).toString() // → "2081-01-15"
	*/
	toString() {
		return this.format("YYYY-MM-DD");
	}
	reset(year, month0, day) {
		this.serial = bsToSerial(year, month0, day);
		this.parts = serialToBs(this.serial);
	}
};
//#endregion
//#region src/bs-string.ts
/**
* Helpers for working with BS dates as "YYYY-MM-DD" strings — the format the
* datepicker components and most form fields pass around. Pure functions; the
* only state they touch is the calendar table.
*/
/**
* Splits a "YYYY-MM-DD" string into `[year, month, day]` numbers
* (month 1-indexed).
*
* Does **not** validate — parts may be `NaN` for malformed input; guard with
* {@link isValidDateString} first when the source is user-typed.
*
* @example
* parseDateString("2081-03-05") // → [2081, 3, 5]
* parseDateString("garbage")    // → [NaN, NaN, NaN]
*/
const parseDateString = (dateString) => {
	const [year, month, day] = dateString.split("-").map((part) => parseInt(part, 10));
	return [
		year,
		month,
		day
	];
};
/**
* Returns `true` when year/month/day name a real day in the BS calendar table
* (month 1-indexed).
*
* @example
* isValidDate(2081, 2, 32) // → true   (BS 2081's Jestha really has 32 days)
* isValidDate(2081, 2, 33) // → false
* isValidDate(1969, 1, 1)  // → false  (before the calendar table)
*/
const isValidDate = (year, month, day) => {
	if (!year || !month || !day) return false;
	const months = CALENDAR_DATA[year];
	return Boolean(months) && month >= 1 && month <= 12 && day >= 1 && day <= months[month - 1];
};
/**
* Returns `true` when the string is strictly zero-padded "YYYY-MM-DD" **and**
* names a real BS day.
*
* @example
* isValidDateString("2081-02-32") // → true  (32-day month)
* isValidDateString("2081-2-05")  // → false (not zero-padded)
* isValidDateString("2081-02-33") // → false (no BS month has 33 days)
*/
const isValidDateString = (dateString) => {
	if (typeof dateString !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
	const [year, month, day] = parseDateString(dateString);
	return isValidDate(year, month, day);
};
/**
* Formats BS date parts (month 1-indexed) as a zero-padded "YYYY-MM-DD" string.
*
* @example
* formatDate(2081, 3, 5) // → "2081-03-05"
*/
const formatDate = (year, month, day) => `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
/**
* Compare two parsed BS dates: negative when a < b, 0 when equal, positive when a > b.
* Purely positional — neither date needs to exist in the calendar table.
*/
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
/**
* Returns `true` when `date` falls inside `[startDate, endDate]`, **both
* bounds inclusive**. A missing or malformed bound means "unbounded on that
* side"; a malformed `date` is never in range. This is what drives the
* pickers' disabledBefore/disabledAfter behaviour.
*
* @example
* isBetween("2081-03-15", "2081-03-15", "2081-03-20") // → true  (inclusive)
* isBetween("2081-03-14", "2081-03-15", undefined)    // → false
* isBetween("2099-12-01", "2081-01-01", undefined)    // → true  (open-ended)
*/
const isBetween = (date, startDate, endDate) => {
	if (!isValidDateString(date)) return false;
	const target = parseDateString(date);
	if (startDate && isValidDateString(startDate) && compare(target, parseDateString(startDate)) < 0) return false;
	if (endDate && isValidDateString(endDate) && compare(target, parseDateString(endDate)) > 0) return false;
	return true;
};
/**
* Month length + starting weekday for one BS month (month 1-indexed).
* Both fields are `undefined` outside the calendar table's year range so a
* calendar grid can simply render nothing rather than throw.
*
* @example
* getMonthData(2081, 1) // → { totalDays: 31, startDay: 6 }  (starts Saturday)
* getMonthData(2150, 1) // → { totalDays: undefined, startDay: undefined }
*/
const getMonthData = (year, month) => ({
	totalDays: CALENDAR_DATA[year] ? CALENDAR_DATA[year][month - 1] : void 0,
	startDay: FIRST_DAY_OF_MONTH[year] ? FIRST_DAY_OF_MONTH[year][month - 1] : void 0
});
/**
* Today's BS date as "YYYY-MM-DD" (device clock, local time).
*
* @example
* getTodayBs() // → e.g. "2083-03-22"
*/
const getTodayBs = () => {
	const today = new NepaliDate();
	return formatDate(today.getYear(), today.getMonth() + 1, today.getDate());
};
//#endregion
//#region src/nepali-date-helpers.ts
/**
* Comparison, arithmetic, and conversion helpers over NepaliDate instances.
* All functions are pure and immutable — arithmetic returns new instances,
* never mutating inputs. Complements the "YYYY-MM-DD" string helpers in
* bs-string.ts; convert between the two worlds with parseNepaliDate /
* toString().
*/
const MS_PER_DAY = 864e5;
/**
* Returns `true` when two BS dates represent the same calendar day.
*
* @example
* isSameDay(new NepaliDate(2081, 0, 1), new NepaliDate(2081, 0, 1)) // → true
* isSameDay(new NepaliDate(2081, 0, 1), new NepaliDate(2081, 0, 2)) // → false
*/
function isSameDay(a, b) {
	return a.getYear() === b.getYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
/**
* Returns `true` when two BS dates fall in the same year and month.
*
* @example
* isSameMonth(new NepaliDate(2081, 0, 1), new NepaliDate(2081, 0, 31)) // → true
* isSameMonth(new NepaliDate(2081, 0, 1), new NepaliDate(2081, 1, 1))  // → false
*/
function isSameMonth(a, b) {
	return a.getYear() === b.getYear() && a.getMonth() === b.getMonth();
}
/**
* Returns `true` when `a` is strictly earlier than `b`.
*
* @example
* isBefore(new NepaliDate(2081, 0, 1), new NepaliDate(2081, 0, 2)) // → true
* isBefore(new NepaliDate(2081, 0, 1), new NepaliDate(2081, 0, 1)) // → false
*/
function isBefore(a, b) {
	if (a.getYear() !== b.getYear()) return a.getYear() < b.getYear();
	if (a.getMonth() !== b.getMonth()) return a.getMonth() < b.getMonth();
	return a.getDate() < b.getDate();
}
/**
* Returns `true` when `a` is strictly later than `b`.
*
* @example
* isAfter(new NepaliDate(2081, 0, 2), new NepaliDate(2081, 0, 1)) // → true
*/
function isAfter(a, b) {
	return isBefore(b, a);
}
/**
* Returns a new NepaliDate offset by `n` days (negative moves backwards).
* O(1): NepaliDate's constructor normalizes day overflow through the serial
* day-count, so month/year boundaries are exact. Throws when the result
* leaves the BS 1970–2099 calendar table.
*
* @example
* addDays(new NepaliDate(2081, 0, 31), 1)  // → BS 2081-02-01
* addDays(new NepaliDate(2081, 0, 1), -1)  // → last day of Chaitra 2080
*/
function addDays(date, n) {
	return new NepaliDate(date.getYear(), date.getMonth(), date.getDate() + n);
}
/**
* Returns a new NepaliDate offset by `n` months (negative moves backwards),
* clamping the day to the target month's length when needed — BS months run
* 29–32 days, so e.g. Jestha 32 + one month lands on the shorter month's
* last day. Throws when the target year leaves the calendar table.
*
* @example
* addMonths(new NepaliDate(2081, 0, 15), 1)  // → BS 2081-02-15
* addMonths(new NepaliDate(2081, 1, 32), 1)  // → BS 2081-03-31 (day clamped)
*/
function addMonths(date, n) {
	const total = date.getMonth() + n;
	const year = date.getYear() + Math.floor(total / 12);
	const month0 = (total % 12 + 12) % 12;
	const monthLength = CALENDAR_DATA[year]?.[month0];
	if (monthLength === void 0) return new NepaliDate(year, month0, 1);
	return new NepaliDate(year, month0, Math.min(date.getDate(), monthLength));
}
/**
* Returns the Sunday beginning the week containing `date` (the Nepali week
* starts on Sunday/Aaitabar).
*
* @example
* startOfWeek(new NepaliDate(2081, 0, 5)) // → BS 2081-01-02 (a Sunday)
*/
function startOfWeek(date) {
	return addDays(date, -date.getDay());
}
/**
* Returns the Saturday ending the week containing `date`.
*
* @example
* endOfWeek(new NepaliDate(2081, 0, 5)) // → BS 2081-01-08 (a Saturday)
*/
function endOfWeek(date) {
	return addDays(date, 6 - date.getDay());
}
/**
* Absolute number of days between two BS dates (order doesn't matter). O(1).
*
* @example
* daysBetween(new NepaliDate(2081, 0, 1), new NepaliDate(2081, 1, 1)) // → 31
* daysBetween(new NepaliDate(2081, 0, 1), new NepaliDate(2081, 0, 1)) // → 0
*/
function daysBetween(a, b) {
	return Math.abs(Math.round((a.toJsDate().getTime() - b.toJsDate().getTime()) / MS_PER_DAY));
}
/**
* Parses a BS date string into a NepaliDate, tolerating unpadded parts and
* `-`, `/` or space separators. Returns `null` for anything that doesn't
* name a real BS day — unlike the NepaliDate constructor, this never rolls
* an invalid day over into the next month.
*
* @example
* parseNepaliDate("2081-03-05") // → NepaliDate for BS 2081-03-05
* parseNepaliDate("2081/3/5")   // → NepaliDate for BS 2081-03-05
* parseNepaliDate("2081-02-33") // → null (would have rolled over via `new NepaliDate`)
* parseNepaliDate("garbage")    // → null
*/
function parseNepaliDate(text) {
	const parts = text.trim().split(/[-/\s]+/);
	if (parts.length !== 3) return null;
	const [year, month, day] = parts.map(Number);
	return isValidDate(year, month, day) ? new NepaliDate(year, month - 1, day) : null;
}
/**
* Converts an AD `Date` straight to a zero-padded BS "YYYY-MM-DD" string.
* Throws when the date is outside the calendar table.
*
* @example
* adToBsString(new Date(2024, 3, 13)) // → "2081-01-01"
*/
function adToBsString(adDate) {
	const { year, month, day } = adToBs(adDate);
	return formatDate(year, month, day);
}
/**
* Converts a BS "YYYY-MM-DD" string straight to a zero-padded AD
* "YYYY-MM-DD" string. Returns `null` when the input isn't a valid BS date.
*
* @example
* bsToAdString("2081-01-01") // → "2024-04-13"
* bsToAdString("2081-02-33") // → null
*/
function bsToAdString(bsDate) {
	if (!isValidDateString(bsDate)) return null;
	const [year, month, day] = parseDateString(bsDate);
	const ad = bsToAd(year, month, day);
	return `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, "0")}-${String(ad.getDate()).padStart(2, "0")}`;
}
/**
* Converts ASCII digits in a number or string to Devanagari numerals.
* Non-digit characters pass through unchanged.
*
* @example
* toNepaliNumerals(2082)         // → "२०८२"
* toNepaliNumerals("2081-01-15") // → "२०८१-०१-१५"
*/
function toNepaliNumerals(value) {
	return String(value).replace(/\d/g, (digit) => LOCALE.np.digits[Number(digit)]);
}
/**
* Converts Devanagari numerals in a string back to ASCII digits.
* Non-numeral characters pass through unchanged.
*
* @example
* toEnglishNumerals("२०८२")  // → "2082"
* toEnglishNumerals("मिति २०८१") // → "मिति 2081"
*/
function toEnglishNumerals(text) {
	return text.replace(/[०-९]/g, (numeral) => String(LOCALE.np.digits.indexOf(numeral)));
}
//#endregion
export { CALENDAR_DATA, FIRST_DAY_OF_MONTH, LOCALE, MAX_BS_YEAR, MIN_BS_YEAR, NEPALI_DAYS, NEPALI_MONTHS, NepaliDate, adToBs, adToBsString, addDays, addMonths, bsToAd, bsToAdString, daysBetween, endOfWeek, formatDate, getMonthData, getTodayBs, isAfter, isBefore, isBetween, isSameDay, isSameMonth, isValidDate, isValidDateString, parseDateString, parseNepaliDate, startOfWeek, toEnglishNumerals, toNepaliNumerals };

//# sourceMappingURL=index.js.map