/**
 * Place photo registry: match step place/activity → remote image URL.
 * Only place-accurate photos (no scenic stand-ins). Prefer Wikimedia Commons
 * 1280px thumbs. Gaps stay null until a real match is found.
 *
 * Private-use alternatives when Commons has nothing: Unsplash/Pexels CDN,
 * Flickr static, Mapillary at the stop coords, Visit Norway / destination sites,
 * or your own trip photos (set `image` / `imagePage` on the itinerary item).
 */

function commons(path1280, pageFile, credit, alt) {
  return {
    src: `https://upload.wikimedia.org/wikipedia/commons/${path1280}`,
    page: `https://commons.wikimedia.org/wiki/File:${pageFile}`,
    credit,
    alt,
  }
}

export const PLACE_IMAGES = {
  // Pickup city (not the exact Indie Campers lot — Commons has no depot photo)
  'indie-campers': {
    ...commons(
      'thumb/c/c1/Puente_de_Troms%C3%B8%2C_Troms%C3%B8%2C_Noruega%2C_2019-09-04%2C_DD_34.jpg/1280px-Puente_de_Troms%C3%B8%2C_Troms%C3%B8%2C_Noruega%2C_2019-09-04%2C_DD_34.jpg',
      'Puente_de_Tromsø,_Tromsø,_Noruega,_2019-09-04,_DD_34.jpg',
      'Diego Delso / Wikimedia',
      'Tromsø bridge — campervan pickup city',
    ),
    match: [/indie campers/i, /håndverkervegen/i],
  },
  ersfjordbotn: {
    ...commons(
      'thumb/0/06/Ersfjordbotn_2012.JPG/1280px-Ersfjordbotn_2012.JPG',
      'Ersfjordbotn_2012.JPG',
      'Simo Räsänen / Wikimedia',
      'Ersfjordbotn, Kvaløya',
    ),
    match: [/ersfjordbotn/i],
  },
  grotfjord: {
    ...commons(
      'thumb/4/44/Panorama_Gr%C3%B8tfjord_-_panoramio.jpg/1280px-Panorama_Gr%C3%B8tfjord_-_panoramio.jpg',
      'Panorama_Grøtfjord_-_panoramio.jpg',
      'Panoramio / Wikimedia',
      'Grøtfjord, Kvaløya',
    ),
    match: [/grøtfjord|grotfjord/i],
  },
  brensholmen: {
    ...commons(
      'thumb/0/0e/View_backwards_from_a_ferry_between_Senja_and_Kval%C3%B8ya%2C_Troms%2C_Norway%2C_2014_August.jpg/1280px-View_backwards_from_a_ferry_between_Senja_and_Kval%C3%B8ya%2C_Troms%2C_Norway%2C_2014_August.jpg',
      'View_backwards_from_a_ferry_between_Senja_and_Kvaløya,_Troms,_Norway,_2014_August.jpg',
      'Ximonic / Wikimedia',
      'Ferry between Brensholmen (Kvaløya) and Botnhamn (Senja)',
    ),
    match: [/brensholmen/i],
  },
  botnhamn: {
    ...commons(
      'thumb/b/bb/Botnhamn.jpg/1280px-Botnhamn.jpg',
      'Botnhamn.jpg',
      'Morten Meyer / Wikimedia',
      'Botnhamn, Senja',
    ),
    match: [/botnhamn/i],
  },
  husoy: {
    ...commons(
      'thumb/f/f1/Hus%C3%B8y_%26_%C3%98yfjorden%2C_Senja%2C_2011_06.jpg/1280px-Hus%C3%B8y_%26_%C3%98yfjorden%2C_Senja%2C_2011_06.jpg',
      'Husøy_&_Øyfjorden,_Senja,_2011_06.jpg',
      'Ximonic / Wikimedia',
      'Husøy and Øyfjorden, Senja',
    ),
    match: [/husøy|husoy/i],
  },
  mefjordvaer: {
    ...commons(
      'thumb/7/73/Wide_shot_to_Mefjordv%C3%A6r_in_evening%2C_Senja%2C_Troms%2C_Norway%2C_2015_September.jpg/1280px-Wide_shot_to_Mefjordv%C3%A6r_in_evening%2C_Senja%2C_Troms%2C_Norway%2C_2015_September.jpg',
      'Wide_shot_to_Mefjordvær_in_evening,_Senja,_Troms,_Norway,_2015_September.jpg',
      'Ximonic / Wikimedia',
      'Mefjordvær, Senja',
    ),
    match: [/mefjord/i],
  },
  tungeneset: {
    ...commons(
      'thumb/4/4d/Tungeneset_utsiktspunkt.jpg/1280px-Tungeneset_utsiktspunkt.jpg',
      'Tungeneset_utsiktspunkt.jpg',
      'Wikimedia Commons',
      'Tungeneset viewpoint, Senja',
    ),
    match: [/tungeneset/i],
  },
  bergsbotn: {
    ...commons(
      'thumb/b/b8/Bergsbotnen-2011.jpg/1280px-Bergsbotnen-2011.jpg',
      'Bergsbotnen-2011.jpg',
      'Wikimedia Commons',
      'Bergsbotn viewpoint, Senja',
    ),
    match: [/bergsbotn/i],
  },
  ersfjordstranda: {
    ...commons(
      'thumb/5/5b/The_beach_in_Ersfjorden_and_the_mountain_range_on_the_north_side_with_Okshornan_at_the_edge.jpg/1280px-The_beach_in_Ersfjorden_and_the_mountain_range_on_the_north_side_with_Okshornan_at_the_edge.jpg',
      'The_beach_in_Ersfjorden_and_the_mountain_range_on_the_north_side_with_Okshornan_at_the_edge.jpg',
      'Ximonic / Wikimedia',
      'Beach in Ersfjorden (Ersfjordstranda), Senja',
    ),
    match: [/ersfjordstranda/i],
  },
  bovar: {
    ...commons(
      'thumb/2/2c/Boevaer-Senja-2011.jpg/1280px-Boevaer-Senja-2011.jpg',
      'Boevaer-Senja-2011.jpg',
      'Wikimedia Commons',
      'Bøvær, Senja',
    ),
    match: [/bøvær|bovar/i],
  },
  hamn: {
    ...commons(
      'thumb/d/dd/View_of_Hamn_i_Senja%2C_Norge_02.jpg/1280px-View_of_Hamn_i_Senja%2C_Norge_02.jpg',
      'View_of_Hamn_i_Senja,_Norge_02.jpg',
      'Wikimedia Commons',
      'Hamn i Senja',
    ),
    match: [/hamn i senja|\bhamn\b/i],
  },
  gryllefjord: {
    ...commons(
      'thumb/d/d7/Gryllefjord-From-Ballesvikskaret.jpg/1280px-Gryllefjord-From-Ballesvikskaret.jpg',
      'Gryllefjord-From-Ballesvikskaret.jpg',
      'Wikimedia Commons',
      'Gryllefjord from Ballesvikskaret, Senja',
    ),
    match: [/gryllefjord/i],
  },
  andenes: {
    ...commons(
      'thumb/0/03/Andenes_fyr.jpg/1280px-Andenes_fyr.jpg',
      'Andenes_fyr.jpg',
      'Wikimedia Commons',
      'Andenes lighthouse',
    ),
    match: [/andenes/i, /whale safari/i],
  },
  bleik: {
    ...commons(
      'thumb/1/1b/Bleik%2C_Bleikstranda_og_Bleiks%C3%B8ya_sett_fra_R%C3%B8yken.jpg/1280px-Bleik%2C_Bleikstranda_og_Bleiks%C3%B8ya_sett_fra_R%C3%B8yken.jpg',
      'Bleik,_Bleikstranda_og_Bleiksøya_sett_fra_Røyken.jpg',
      'Wolfgang Hägele / Wikimedia',
      'Bleik beach and Bleiksøya, Andøya',
    ),
    match: [/bleik|midnattsol/i],
  },
  kleivodden: {
    ...commons(
      'thumb/e/ea/Bleiks%C3%B8ya_sett_fra_Kleivodden.jpg/1280px-Bleiks%C3%B8ya_sett_fra_Kleivodden.jpg',
      'Bleiksøya_sett_fra_Kleivodden.jpg',
      'Wikimedia Commons',
      'Bleiksøya from Kleivodden rest area, Andøya',
    ),
    match: [/kleivodden/i],
  },
  matinden: {
    ...commons(
      'thumb/3/31/Matind_Feb_2026.jpg/1280px-Matind_Feb_2026.jpg',
      'Matind_Feb_2026.jpg',
      'Wikimedia Commons',
      'Måtinden (Matind), Andøya',
    ),
    match: [/måtinden|matinden|baugtua/i],
  },
  bukkekjerka: {
    ...commons(
      'thumb/9/9c/Aurora_Borealis_en_Bukkekjerka_And%C3%B8ya_%2849646640863%29.jpg/1280px-Aurora_Borealis_en_Bukkekjerka_And%C3%B8ya_%2849646640863%29.jpg',
      'Aurora_Borealis_en_Bukkekjerka_Andøya_(49646640863).jpg',
      'Flickr / Wikimedia',
      'Bukkekjerka, Andøya',
    ),
    match: [/bukkekjerka/i],
  },
  risoyhamn: {
    ...commons(
      'thumb/f/f8/Ris%C3%B8yhamn.jpg/1280px-Ris%C3%B8yhamn.jpg',
      'Risøyhamn.jpg',
      'Wikimedia Commons',
      'Risøyhamn, Andøya',
    ),
    match: [/risøyhamn|risoyhamn/i],
  },
  nyksund: {
    ...commons(
      'thumb/0/01/Nyksund_2006-02.jpg/1280px-Nyksund_2006-02.jpg',
      'Nyksund_2006-02.jpg',
      'Wikimedia Commons',
      'Nyksund, Vesterålen',
    ),
    match: [/nyksund/i],
  },
  sto: {
    ...commons(
      'thumb/e/e1/St%C3%B8_01.jpg/1280px-St%C3%B8_01.jpg',
      'Stø_01.jpg',
      'Wikimedia Commons',
      'Stø, Vesterålen',
    ),
    match: [/\bstø\b|\bsto harbour\b/i],
  },
  sortland: {
    ...commons(
      'thumb/7/7f/Sortland_kirke_-_an10071209074001.jpg/1280px-Sortland_kirke_-_an10071209074001.jpg',
      'Sortland_kirke_-_an10071209074001.jpg',
      'Riksantikvaren / Wikimedia',
      'Sortland church, Vesterålen',
    ),
    match: [/sortland/i],
  },
  malselvfossen: {
    ...commons(
      'thumb/9/9f/M%C3%A5lselvfossen.jpg/1280px-M%C3%A5lselvfossen.jpg',
      'Målselvfossen.jpg',
      'Wikimedia Commons',
      'Målselvfossen',
    ),
    match: [/målselvfossen|malselvfossen|målselv/i],
  },
  finnsnes: {
    ...commons(
      'thumb/a/a0/Finnsnes_Norwegen_Hafen.jpg/1280px-Finnsnes_Norwegen_Hafen.jpg',
      'Finnsnes_Norwegen_Hafen.jpg',
      'Wikimedia Commons',
      'Finnsnes harbour',
    ),
    match: [/finnsnes/i],
  },
  breivikeidet: {
    ...commons(
      'thumb/1/18/Breivikeidet_%28Guohcavuopmi%29_%26_Fv91%2C_2011_October.jpg/1280px-Breivikeidet_%28Guohcavuopmi%29_%26_Fv91%2C_2011_October.jpg',
      'Breivikeidet_(Guohcavuopmi)_&_Fv91,_2011_October.jpg',
      'Ximonic / Wikimedia',
      'Breivikeidet (Guohcavuopmi), Troms',
    ),
    match: [/breivikeidet/i],
  },
  svensby: {
    ...commons(
      'thumb/2/26/Lakselvtindane_from_Ullsfjorden.JPG/1280px-Lakselvtindane_from_Ullsfjorden.JPG',
      'Lakselvtindane_from_Ullsfjorden.JPG',
      'Wikimedia Commons',
      'Lakselvtindane from Ullsfjorden (Svensby ferry shore)',
    ),
    match: [/svensby|ullsfjord/i],
  },
  lyngseidet: {
    ...commons(
      'thumb/d/d1/Lyngseidet-kjosen-lyngen-alps.jpg/1280px-Lyngseidet-kjosen-lyngen-alps.jpg',
      'Lyngseidet-kjosen-lyngen-alps.jpg',
      'Wikimedia Commons',
      'Lyngseidet and Lyngen Alps',
    ),
    match: [/lyngseidet/i],
  },
  blaisvatnet: {
    ...commons(
      'thumb/a/ab/Bl%C3%A5isvannet_%28Lyngen%29.jpg/1280px-Bl%C3%A5isvannet_%28Lyngen%29.jpg',
      'Blåisvannet_(Lyngen).jpg',
      'Harald Groven / Wikimedia',
      'Blåisvatnet, Lyngen',
    ),
    match: [/blåisvatnet|blaisvatnet/i],
  },
  olderdalen: {
    ...commons(
      'thumb/6/61/Olderdalen_K%C3%A5fjord_01.jpg/1280px-Olderdalen_K%C3%A5fjord_01.jpg',
      'Olderdalen_Kåfjord_01.jpg',
      'Wikimedia Commons',
      'Olderdalen, Kåfjord',
    ),
    match: [/olderdalen/i],
  },
  nordmannvik: {
    ...commons(
      'thumb/1/19/Nordmannvik_in_Kaafjord%2C_Norway.jpg/1280px-Nordmannvik_in_Kaafjord%2C_Norway.jpg',
      'Nordmannvik_in_Kaafjord,_Norway.jpg',
      'Wikimedia Commons',
      'Nordmannvik, Kåfjord',
    ),
    match: [/nordmannvik/i],
  },
  steindalsbreen: {
    ...commons(
      'thumb/a/a0/Steindalsbreen.jpg/1280px-Steindalsbreen.jpg',
      'Steindalsbreen.jpg',
      'Wikimedia Commons',
      'Steindalsbreen glacier, Lyngen',
    ),
    match: [/steindal/i],
  },
  segla: {
    ...commons(
      'thumb/f/ff/Segla_Senja.jpg/1280px-Segla_Senja.jpg',
      'Segla_Senja.jpg',
      'Wikimedia Commons',
      'Segla, Senja',
    ),
    match: [/segla/i],
  },
  hesten: {
    ...commons(
      'thumb/c/c2/View_from_a_ridge_between_Segla_and_Hesten%2C_Senja%2C_Norway%2C_2014_August.jpg/1280px-View_from_a_ridge_between_Segla_and_Hesten%2C_Senja%2C_Norway%2C_2014_August.jpg',
      'View_from_a_ridge_between_Segla_and_Hesten,_Senja,_Norway,_2014_August.jpg',
      'Ximonic / Wikimedia',
      'Ridge between Segla and Hesten, Senja',
    ),
    match: [/hesten|fjordgård|fjordgard/i],
  },
  tromso: {
    ...commons(
      'thumb/c/c1/Puente_de_Troms%C3%B8%2C_Troms%C3%B8%2C_Noruega%2C_2019-09-04%2C_DD_34.jpg/1280px-Puente_de_Troms%C3%B8%2C_Troms%C3%B8%2C_Noruega%2C_2019-09-04%2C_DD_34.jpg',
      'Puente_de_Tromsø,_Tromsø,_Noruega,_2019-09-04,_DD_34.jpg',
      'Diego Delso / Wikimedia',
      'Tromsø bridge',
    ),
    match: [/tromsø|tromso/i],
  },
}

/**
 * @param {{ place?: string, activity?: string, optLabel?: string, image?: string, imageAlt?: string, imageCredit?: string, imagePage?: string, interline?: boolean }} step
 */
export function imageForStep(step) {
  if (step?.image) {
    return {
      src: step.image,
      alt: step.imageAlt || step.place || step.activity || 'Place',
      credit: step.imageCredit || '',
      page: step.imagePage || step.image,
      slug: 'custom',
    }
  }
  if (step?.interline && (step.sun || step.meal)) return null
  if (step?.activity === 'Drive') return null

  const hay = [step?.place, step?.optLabel, step?.activity]
    .filter(Boolean)
    .join(' · ')
  if (!hay) return null

  for (const [slug, meta] of Object.entries(PLACE_IMAGES)) {
    if (meta.match.some((re) => re.test(hay))) {
      return { ...meta, slug }
    }
  }
  return null
}
