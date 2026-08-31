// Shared UI reference data for Sri Lanka provider registration.
export const SRI_LANKA_TOWNS = [
  ['Colombo', 'Western'], ['Sri Jayawardenepura Kotte', 'Western'], ['Dehiwala-Mount Lavinia', 'Western'], ['Kaduwela', 'Western'], ['Moratuwa', 'Western'], ['Kolonnawa', 'Western'], ['Seethawakapura', 'Western'], ['Maharagama', 'Western'], ['Kesbewa', 'Western'], ['Boralesgamuwa', 'Western'], ['Gampaha', 'Western'], ['Negombo', 'Western'], ['Wattala', 'Western'], ['Katunayake-Seeduwa', 'Western'], ['Minuwangoda', 'Western'], ['Ja-Ela', 'Western'], ['Peliyagoda', 'Western'], ['Kalutara', 'Western'], ['Panadura', 'Western'], ['Horana', 'Western'], ['Beruwala', 'Western'],
  ['Kandy', 'Central'], ['Wattegama', 'Central'], ['Kadugannawa', 'Central'], ['Gampola', 'Central'], ['Nawalapitiya', 'Central'], ['Matale', 'Central'], ['Dambulla', 'Central'], ['Nuwara Eliya', 'Central'], ['Hatton-Dickoya', 'Central'], ['Thalawakele-Lindula', 'Central'],
  ['Galle', 'Southern'], ['Ambalangoda', 'Southern'], ['Hikkaduwa', 'Southern'], ['Matara', 'Southern'], ['Weligama', 'Southern'], ['Hambantota', 'Southern'], ['Tangalle', 'Southern'],
  ['Jaffna', 'Northern'], ['Valvettithurai', 'Northern'], ['Point Pedro', 'Northern'], ['Chavakachcheri', 'Northern'], ['Mannar', 'Northern'], ['Vavuniya', 'Northern'],
  ['Trincomalee', 'Eastern'], ['Kinniya', 'Eastern'], ['Batticaloa', 'Eastern'], ['Eravur', 'Eastern'], ['Kattankudy', 'Eastern'], ['Kalmunai', 'Eastern'], ['Akkaraipattu', 'Eastern'], ['Ampara', 'Eastern'],
  ['Kurunegala', 'North Western'], ['Kuliyapitiya', 'North Western'], ['Puttalam', 'North Western'], ['Chilaw', 'North Western'],
  ['Anuradhapura', 'North Central'], ['Polonnaruwa', 'North Central'],
  ['Badulla', 'Uva'], ['Bandarawela', 'Uva'], ['Haputale', 'Uva'], ['Monaragala', 'Uva'],
  ['Ratnapura', 'Sabaragamuwa'], ['Balangoda', 'Sabaragamuwa'], ['Embilipitiya', 'Sabaragamuwa'], ['Kegalle', 'Sabaragamuwa'],
].map(([name, province]) => ({ name, province }));

export const SRI_LANKA_PROVINCES = [...new Set(SRI_LANKA_TOWNS.map((location) => location.province))];
