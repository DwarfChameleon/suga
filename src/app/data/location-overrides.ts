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
            'Etegwe',
            'Immiringi Road',
            'Tombia Roundabout',
            'Amasoma Road',
            'Okutukutu',
            'Opolo',
            'Sipem Road',
            'Opolo Roundabout',
            'Biogbolo',
            'Yenizweghene',
            'Kpansia',
            'Nikton',
            'Kpansia Market',
            'Yenizwe-Epie',
            'Okaka',
            'Okaka Junction',
            'Okaka Estate',
            'Okaka Prison Road',
            'Ekeki',
            'Azikoro Road',
            'Amarata',
            'Back of Amarata',
            'Imgbi Road',
            'Bayelsa Medical University',
            'Imgbi Roundabout',
            'Azikoro',
            'Azikoro Roundabout',
            'Bayelsa Palm',
            'Oxbow Lake',
            'Agbura',
            'Onopa',
            'Ovom',
            'Government House Road',
            'Road Safety Area',
            'FMC',
            'Sports Complex',
            'UBA Market Road',
            'Gwe-Gwe',
            'Down Yenagoa',
            'Swali',
            'Oxbow Lake Road',
            'Market',
            'Local Content',
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
  },
  Zimbabwe: {
    states: {
      Harare: [
        { name: 'Harare', suburbs: ['Avondale', 'Borrowdale', 'Highlands', 'Mbare', 'Glen View', 'Kuwadzana', 'Dzivarasekwa', 'Waterfalls', 'Hatfield', 'Mount Pleasant'] },
        { name: 'Chitungwiza' },
        { name: 'Epworth' }
      ],
      Bulawayo: [
        { name: 'Bulawayo', suburbs: ['Luveve', 'Nkulumane', 'Pumula', 'Cowdray Park', 'Entumbane', 'Hillside', 'Mzilikazi', 'Famona'] }
      ],
      Manicaland: [
        { name: 'Mutare' },
        { name: 'Chipinge' },
        { name: 'Rusape' },
        { name: 'Nyanga' },
        { name: 'Chimanimani' },
        { name: 'Buhera' }
      ],
      'Mashonaland West': [
        { name: 'Chinhoyi' },
        { name: 'Kadoma' },
        { name: 'Kariba' },
        { name: 'Chegutu' },
        { name: 'Norton' },
        { name: 'Karoi' }
      ],
      'Mashonaland East': [
        { name: 'Marondera' },
        { name: 'Mutoko' },
        { name: 'Murehwa' },
        { name: 'Chivhu' },
        { name: 'Goromonzi' }
      ],
      'Mashonaland Central': [
        { name: 'Bindura' },
        { name: 'Mazowe' },
        { name: 'Shamva' },
        { name: 'Guruve' },
        { name: 'Mount Darwin' }
      ],
      Masvingo: [
        { name: 'Masvingo' },
        { name: 'Chiredzi' },
        { name: 'Triangle' },
        { name: 'Gutu' },
        { name: 'Bikita' },
        { name: 'Zaka' }
      ],
      Midlands: [
        { name: 'Gweru' },
        { name: 'Kwekwe' },
        { name: 'Shurugwi' },
        { name: 'Zvishavane' },
        { name: 'Redcliff' },
        { name: 'Mvuma' }
      ],
      'Matabeleland North': [
        { name: 'Victoria Falls' },
        { name: 'Hwange' },
        { name: 'Lupane' },
        { name: 'Binga' },
        { name: 'Tsholotsho' }
      ],
      'Matabeleland South': [
        { name: 'Gwanda' },
        { name: 'Beitbridge' },
        { name: 'Plumtree' },
        { name: 'Esigodini' },
        { name: 'Filabusi' }
      ]
    }
  },
  Malawi: {
    states: {
      'Northern Region': [
        { name: 'Mzuzu', suburbs: ['Luwinga', 'Chibavi', 'Katoto', 'Mchengautuwa', 'Masasa'] },
        { name: 'Karonga' },
        { name: 'Nkhata Bay' },
        { name: 'Rumphi' },
        { name: 'Chitipa' },
        { name: 'Mzimba' }
      ],
      'Central Region': [
        { name: 'Lilongwe', suburbs: ['Area 3', 'Area 6', 'Area 10', 'Area 12', 'Area 18', 'Area 23', 'Area 25', 'Area 36', 'City Centre', 'Kanengo'] },
        { name: 'Dedza' },
        { name: 'Dowa' },
        { name: 'Kasungu' },
        { name: 'Mchinji' },
        { name: 'Nkhotakota' },
        { name: 'Ntcheu' },
        { name: 'Ntchisi' },
        { name: 'Salima' }
      ],
      'Southern Region': [
        { name: 'Blantyre', suburbs: ['Limbe', 'Ndirande', 'Chilomoni', 'Soche', 'Manja', 'Nyambadwe', 'Sunnyside'] },
        { name: 'Zomba' },
        { name: 'Mangochi' },
        { name: 'Mulanje' },
        { name: 'Thyolo' },
        { name: 'Chiradzulu' },
        { name: 'Balaka' },
        { name: 'Machinga' },
        { name: 'Mwanza' },
        { name: 'Nsanje' },
        { name: 'Chikwawa' },
        { name: 'Phalombe' },
        { name: 'Neno' }
      ]
    }
  }
};

