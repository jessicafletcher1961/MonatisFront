package fr.colline.monatis.comptes.controller;

import java.util.function.Function;

import org.springframework.data.domain.Page;

import fr.colline.monatis.comptes.model.Compte;

public class ComptePageResponseDtoMapper {

	private ComptePageResponseDtoMapper() {}

	public static <T extends Compte> ComptePageResponseDto mapperPageToResponseDto(
			Page<T> page,
			Function<T, CompteResponseDto> mapperCompte) {

		ComptePageResponseDto dto = new ComptePageResponseDto();
		dto.comptes = page.getContent()
				.stream()
				.map(mapperCompte)
				.toList();
		dto.numeroPage = page.getNumber() + 1;
		dto.taillePage = page.getSize();
		dto.totalComptes = page.getTotalElements();
		dto.totalPages = page.getTotalPages();
		dto.premierElement = page.getTotalElements() == 0 ? 0L : page.getNumber() * (long) page.getSize() + 1;
		dto.dernierElement = page.getTotalElements() == 0 ? 0L : dto.premierElement + page.getNumberOfElements() - 1;
		return dto;
	}

}
