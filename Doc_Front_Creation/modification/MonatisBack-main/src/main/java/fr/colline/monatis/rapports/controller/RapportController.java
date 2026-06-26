// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/RapportController.java

// Modification : ajout de RequestMethod.
// Pourquoi : les rapports doivent rester compatibles avec les anciens GET,
// mais le front doit pouvoir les consommer proprement en POST avec un body JSON.
import org.springframework.web.bind.annotation.RequestMethod;

// Modification : les endpoints de rapports ci-dessous acceptent maintenant GET et POST.
// Pourquoi : GET + @RequestBody est fragile cote navigateur/proxy ; POST devient le chemin
// propre utilise par le front, tout en conservant les anciens GET.

@RequestMapping(value = "/releve_compte", method = { RequestMethod.GET, RequestMethod.POST })
public ReleveCompteResponseDto getReleveCompte(
		@RequestBody ReleveCompteRequestDto requestDto) throws ControllerException, ServiceException {
	// Corps de methode inchange.
}

@RequestMapping(value = "/releve_non_categorise", method = { RequestMethod.GET, RequestMethod.POST })
public ReleveNonCategoriseResponseDto getReleveNonCategorise(
		@RequestBody ReleveNonCategoriseRequestDto requestDto) throws ControllerException, ServiceException {
	// Corps de methode inchange.
}

@RequestMapping(value = "/releve_sous_categorie", method = { RequestMethod.GET, RequestMethod.POST })
public ReleveSousCategorieResponseDto getReleveSousCategorie(
		@RequestBody ReleveSousCategorieRequestDto requestDto) throws ControllerException, ServiceException {
	// Corps de methode inchange.
}

@RequestMapping(value = "/resumes_comptes_internes", method = { RequestMethod.GET, RequestMethod.POST })
public List<ResumeCompteInterneResponseDto> getListeResumeCompteInterne(
		@RequestBody ResumeCompteInterneRequestDto requestDto) throws ControllerException, ServiceException {
	// Corps de methode inchange.
}

@RequestMapping(value = "/depense_recette", method = { RequestMethod.GET, RequestMethod.POST })
public EtatDepenseRecetteResponseDto getEtatDepenseRecette
(@RequestBody EtatDepenseRecetteRequestDto requestDto) throws ServiceException, ControllerException {
	// Corps de methode inchange.
}

@RequestMapping(value = "/plus_moins_value", method = { RequestMethod.GET, RequestMethod.POST })
public EtatPlusMoinsValueResponseDto getEtatPlusMoinsValue(
		@RequestBody EtatPlusMoinsValueRequestDto requestDto) throws ControllerException, ServiceException {
	// Corps de methode inchange.
}

@RequestMapping(value = "/remunerations_frais", method = { RequestMethod.GET, RequestMethod.POST })
public EtatRemunerationsFraisResponseDto getEtatRemunerationsFrais(
		@RequestBody EtatRemunerationsFraisRequestDto requestDto) throws ServiceException, ControllerException {
	// Corps de methode inchange.
}

@RequestMapping(value = "/bilan_patrimoine", method = { RequestMethod.GET, RequestMethod.POST })
public EtatBilanPatrimoineResponseDto getEtatBilanPatrimoine(
		@RequestBody EtatBilanPatrimoineRequestDto requestDto) throws ControllerException, ServiceException {
	// Corps de methode inchange.
}

// Modification : suppression du Sort Spring explicite dans la pagination du releve.
// Pourquoi : l'ordre du releve est maintenant porte par les requetes repository,
// qui trient sur la date de comptabilisation de la ligne principale, puis numero/id.
// Garder un Sort "dateValeur" ici risquait de contredire cet ordre metier.

private PageRequest creerPaginationOperationsRapport(Integer numeroPage, Integer taillePage) {

	if (numeroPage == null && taillePage == null) {
		return null;
	}

	return PageRequest.of(
			numeroPageApiVersIndexPageSpring(numeroPage),
			taillePage(taillePage));
}
