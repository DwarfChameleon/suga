export interface LocationCityOverride {
  name: string;
  suburbs?: string[];
}

export interface CountryLocationOverride {
  restrictToCustomStates?: boolean;
  restrictToCustomCities?: boolean;
  states: Record<string, LocationCityOverride[]>;
}

export const LOCATION_OVERRIDES: Record<string, CountryLocationOverride> = {
  Nigeria: {
    states: {
      Bayelsa: [
        {
          name: 'Yenagoa',
          suburbs: [
            'Igbogene',
            'Yenegwe',
            'Akenfa',
            'Agudama',
            'Akenpai',
            'Etegwe (Immiringi Road, Tombia Roundabout, Amasoma Road)',
            'Okutukutu',
            'Opolo (Sipem Road, Opolo Roundabout)',
            'Biogbolo',
            'Yenizweghene',
            'Kpansia (Sipem Road, Nikton, Kpansia Market)',
            'Yenizwe-Epie',
            'Okaka (Okaka Junction, Okaka Estate, Okaka Prison Road)',
            'Ekeki (Azikoro Road)',
            'Amarata (Back of Amarata, Imgbi Road, Bayelsa Medical University, Imgbi Roundabout)',
            'Azikoro (Azikoro Roundabout, Bayelsa Palm, Oxbow Lake)',
            'Agbura',
            'Onopa',
            'Ovom (Government House Road, Road Safety Area, FMC, Sports Complex, UBA Market Road, Gwe-Gwe)',
            'Down Yenagoa',
            'Swali (Oxbow Lake Road, Market, Local Content)',
            'Obogoro',
            'Akaba',
            'Famgbe',
            'Ogu'
          ]
        },
        {
          name: 'Outskirt of Yenagoa',
          suburbs: [
            'Amasoama',
            'Outeke',
            'Otukpoti',
            'Immiringi',
            'Obuna',
            'Okolobiri',
            'Mbiama',
            'Okaki Road'
          ]
        }
      ],
      Rivers: [
        { name: 'Ahoada' },
        { name: 'Choba' },
        { name: 'Alakai' },
        { name: 'Rumosi' },
        { name: 'Rumeke' },
        { name: 'Rumokoro', suburbs: ['Park', 'Round-about'] },
        { name: 'Eliose' },
        { name: 'Trans-amadi' },
        { name: 'Rumola' },
        { name: 'Airport Road' },
        { name: 'Rumodara' },
        { name: 'Oilmill' },
        { name: 'Rumomio' },
        { name: 'Rumomeme' },
        { name: 'GRA' },
        { name: 'Woji', suburbs: ['Woji Estate', 'Railway', 'YKC', 'Slaughter'] },
        { name: 'Ada George' },
        { name: 'Mile 1' },
        { name: 'Mile 12' },
        { name: 'Eleme' },
        { name: 'Oniel' }
      ],
      Delta: [
        { name: 'Warri' },
        { name: 'Ugheli' },
        { name: 'Asaba' },
        { name: 'Sea-port' },
        { name: 'Efurun', suburbs: ['Shoprite', 'Trailer Yard', 'Naval Base'] },
        { name: 'Airport Road' },
        { name: 'Agbaru' },
        { name: 'Ekpa' },
        { name: 'Ikoduru' },
        { name: 'Shell Yard' },
        { name: 'Sapele' }
      ],
      Lagos: [
        { name: 'Oshodi' },
        { name: 'Mushin' },
        { name: 'Meryland' },
        { name: 'Mile 2' },
        { name: 'Mazamaza' },
        { name: 'Iyanakpaja' },
        { name: 'Jibowu' },
        { name: 'Festac' },
        { name: 'Ajah' },
        { name: 'Ajegunle' },
        { name: 'Redeemers Camp' },
        { name: 'Badagiri' },
        { name: 'Lagos State University' },
        { name: 'UNILAG' },
        {
          name: 'Lekki',
          suburbs: ['Ajah', 'Sangotedo', 'Phase 1', 'Phase 2', 'Phase 3', 'Banana Island', 'Ecocity']
        },
        { name: 'Ikeja', suburbs: ['Murtala Mohamed Airport'] },
        { name: 'Ajasco' },
        { name: 'Ikotu' }
      ]
    }
  }
};
