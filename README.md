# Portfolio Risk Analyzer

Interaktivna web-aplikacija za analizu rizika investicijskog portfelja korištenjem Monte Carlo simulacije.

Projekt uspoređuje dvije implementacije Monte Carlo simulacije:
- JavaScript implementaciju
- WebAssembly (Rust) implementaciju

Cilj projekta je analizirati ponašanje portfelja kroz velik broj simuliranih scenarija te usporediti performanse JavaScript i WebAssembly implementacije.

## Opis projekta

Aplikacija modelira kretanje vrijednosti investicijskog portfelja pomoću geometrijskog Brownovog gibanja (GBM).

Za svaku imovinu definiraju se:
- naziv imovine
- udio u portfelju
- očekivani godišnji prinos
- godišnja volatilnost

Korelirana slučajna odstupanja generiraju se pomoću Choleskyjeve dekompozicije korelacijske matrice.
Monte Carlo simulacija zatim generira velik broj mogućih budućih putanja vrijednosti portfelja.

Na temelju dobivenih rezultata računaju se statistike rizika, uključujući:
- prosječnu završnu vrijednost
- medijan
- standardnu devijaciju
- 5. percentil
- 95. percentil
- VaR
- CVaR

## Usporedba performansi
Projekt sadrži posebnu stranicu za mjerenje i usporedbu performansi:
web/benchmark.html

Benchmark uspoređuje vrijeme izvođenja JavaScript i WebAssembly implementacije za različite veličine Monte Carlo simulacije.
Trenutno se testiraju sljedeće veličine:
100
1 000
10 000
50 000
100 000

Za svaku veličinu simulacije provodi se više zagrijavajućih pokretanja i više ponavljanja mjerenja.
Benchmark prikazuje:
* prosječno vrijeme izvođenja
* medijan
* standardnu devijaciju
* ubrzanje WebAssembly implementacije u odnosu na JavaScript
Za osiguravanje reproducibilnosti koristi se deterministički generator slučajnih brojeva i fiksno sjeme.

### Rust / WebAssembly
Rust implementacija uključuje:
- deterministički `ChaCha8Rng`
- normalnu distribuciju pomoću `rand_distr::Normal`
- Cholesky dekompoziciju korelacijske matrice
- generiranje koreliranih normalnih šokova
- Geometric Brownian Motion (GBM)
- Monte Carlo simulaciju portfelja
- izračun statističkih pokazatelja
Rust kod se pomoću `wasm-bindgen` prevodi u WebAssembly kako bi se mogao koristiti iz JavaScripta.

### JavaScript
JavaScript implementacija sadrži ekvivalentnu Monte Carlo simulaciju.
Implementacije koriste isto:
- početno ulaganje
- očekivane prinose
- volatilnosti
- udjele imovine
- korelacijsku matricu
- broj godina
- broj simulacija
- sjeme generatora slučajnih brojeva
Na taj način moguće je usporediti rezultate JavaScript i WASM implementacije.

## Pokretanje projekta
Za pokretanje WebAssembly implementacije potrebno je imati instalirano:
* Rust
* Cargo
* wasm-pack
* Python 3 (za lokalni HTTP server)

Nakon kloniranja repozitorija potrebno je prije pokretanja web-aplikacije izgraditi WebAssembly modul.
```bash
wasm-pack build --target web --release
```
Nakon izgradnje pokrenite lokalni HTTP server iz direktorija `web`:
```bash
cd web
python -m http.server 8000
```
Zatim otvorite:
```text
http://localhost:8000/
```
Web-aplikaciju moguće je otvoriti preko odgovarajuće HTML stranice.

## Benchmark
Za pokretanje mjerenja performansi otvorite:
```text
http://localhost:8000/benchmark.html
```
Benchmark stranica prikazuje ulazne parametre, status testiranja, progress bar te rezultate pojedinih mjerenja.
### Važno
WebAssembly modul potrebno je izgraditi u `release` načinu:
```bash
wasm-pack build --target web --release
```
Release build je važan za realno mjerenje performansi. Debug build može značajno usporiti WebAssembly implementaciju i dati nereprezentativne rezultate.

