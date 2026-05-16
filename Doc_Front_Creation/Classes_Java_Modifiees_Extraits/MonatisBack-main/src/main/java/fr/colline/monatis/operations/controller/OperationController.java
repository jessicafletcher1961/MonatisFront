/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\operations\controller\OperationController.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Modifiees_Extraits\MonatisBack-main\src\main\java\fr\colline\monatis\operations\controller\OperationController.java
 * Extraits uniquement: parties modifiees, avec commentaires sur les changements.
 */
import java.util.HashSet; // MODIFIE: aggregation des types demandes par la pagination.
import java.util.Set; // MODIFIE: support du filtre multi-types.

import org.springframework.data.domain.Page; // MODIFIE: reception de la page retournee par le service.
import org.springframework.data.domain.PageRequest; // MODIFIE: creation de la pagination Spring.
import org.springframework.data.domain.Sort; // MODIFIE: tri stable de l'historique.

import fr.colline.monatis.operations.controller.request.OperationPageRequestDto; // MODIFIE: DTO de requete paginee.
import fr.colline.monatis.operations.controller.response.OperationPageResponseDto; // MODIFIE: DTO de reponse paginee.
import fr.colline.monatis.operations.repository.OperationSpecifications; // MODIFIE: filtres JPA dynamiques.

private final int TAILLE_PAGE_OPERATION_PAR_DEFAUT = 50; // MODIFIE: taille par defaut de l'historique pagine.
private final int TAILLE_PAGE_OPERATION_MAX = 200; // MODIFIE: garde-fou contre les pages trop lourdes.

@PostMapping("/page") // MODIFIE: nouvel endpoint POST /monatis/operations/page.
public OperationPageResponseDto paginerOperations(
        @RequestBody(required = false) OperationPageRequestDto requestDto) throws ServiceException, ControllerException {

    OperationPageRequestDto requete = requestDto == null ? new OperationPageRequestDto() : requestDto;
    final String recherche = verificateur.verifierLibelle(requete.recherche, FACULTATIF, null);
    final LocalDate dateDebut = verificateur.verifierDate(requete.depuisLe, FACULTATIF, null);
    final LocalDate dateFin = verificateur.verifierDate(requete.jusqueAu, FACULTATIF, null);
    final Long montantEnCentimes = verificateur.verifierMontantEnCentimes(requete.montantEnCentimes, FACULTATIF, null);
    final Set<TypeOperation> typesOperation = verifierTypesOperation(requete); // MODIFIE: accepte codeTypeOperation et codesTypeOperation.
    final Compte compteRecetteOuDepense = verificateur.verifierCompte(requete.identifiantCompteRecetteOuDepense, FACULTATIF);
    final Compte compteDepense = verificateur.verifierCompte(requete.identifiantCompteDepense, FACULTATIF);
    final Compte compteRecette = verificateur.verifierCompte(requete.identifiantCompteRecette, FACULTATIF);
    final Boolean pointee = verificateur.verifierBoolean(requete.pointee, FACULTATIF, null);

    PageRequest pagination = PageRequest.of(
            numeroPageApiVersIndexPageSpring(requete.numeroPage), // MODIFIE: API en base 1 convertie en base 0 Spring.
            taillePage(requete.taillePage), // MODIFIE: borne min/max appliquee.
            Sort.by(Sort.Direction.DESC, "dateValeur")
                .and(Sort.by(Sort.Direction.ASC, "numero"))
                .and(Sort.by(Sort.Direction.DESC, "id"))); // MODIFIE: tri stable.

    Page<Operation> page = operationService.rechercherPage(
            OperationSpecifications.filtrer(
                    recherche,
                    typesOperation,
                    dateDebut,
                    dateFin,
                    montantEnCentimes,
                    compteRecetteOuDepense == null ? null : compteRecetteOuDepense.getId(),
                    compteRecette == null ? null : compteRecette.getId(),
                    compteDepense == null ? null : compteDepense.getId(),
                    pointee),
            pagination);

    return mapperPageToResponseDto(page); // MODIFIE: transforme Page<Operation> en contrat API front-friendly.
}

private Set<TypeOperation> verifierTypesOperation(OperationPageRequestDto requestDto) throws ControllerException { // MODIFIE: support du filtre simple et multi-types.

    Set<TypeOperation> typesOperation = new HashSet<>();
    TypeOperation typeOperation = verificateur.verifierTypeOperation(requestDto.codeTypeOperation, FACULTATIF, null);

    if (typeOperation != null) {
        typesOperation.add(typeOperation);
    }

    if (requestDto.codesTypeOperation != null) {
        for (String codeTypeOperation : requestDto.codesTypeOperation) {
            typeOperation = verificateur.verifierTypeOperation(codeTypeOperation, FACULTATIF, null);
            if (typeOperation != null) {
                typesOperation.add(typeOperation);
            }
        }
    }

    return typesOperation;
}

private int numeroPageApiVersIndexPageSpring(Integer numeroPage) { // MODIFIE: conversion 1-based vers 0-based.

    if (numeroPage == null || numeroPage < 1) {
        return 0;
    }

    return numeroPage - 1;
}

private int taillePage(Integer taillePage) { // MODIFIE: applique defaut, minimum et maximum.

    if (taillePage == null) {
        return TAILLE_PAGE_OPERATION_PAR_DEFAUT;
    }

    if (taillePage < 1) {
        return 1;
    }

    return Math.min(taillePage, TAILLE_PAGE_OPERATION_MAX);
}

private OperationPageResponseDto mapperPageToResponseDto(Page<Operation> page) { // MODIFIE: ajoute les metadonnees de pagination.

    OperationPageResponseDto dto = new OperationPageResponseDto();
    dto.operations = page.getContent()
            .stream()
            .map((o) -> {return OperationResponseDtoMapper.mapperModelToBasicResponseDto(o);})
            .toList();
    dto.numeroPage = page.getNumber() + 1;
    dto.taillePage = page.getSize();
    dto.totalOperations = page.getTotalElements();
    dto.totalPages = page.getTotalPages();
    dto.premierElement = page.getTotalElements() == 0 ? 0L : page.getNumber() * (long) page.getSize() + 1;
    dto.dernierElement = page.getTotalElements() == 0 ? 0L : dto.premierElement + page.getNumberOfElements() - 1;
    return dto;
}
