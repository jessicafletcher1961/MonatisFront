package fr.colline.monatis.references.controller;

import java.util.function.Function;

import org.springframework.data.domain.Page;

import fr.colline.monatis.references.model.Reference;

public class ReferencePageResponseDtoMapper {

	private ReferencePageResponseDtoMapper() {}

	public static <T extends Reference> ReferencePageResponseDto mapperPageToResponseDto(
			Page<T> page,
			Function<T, ReferenceResponseDto> mapperReference) {

		ReferencePageResponseDto dto = new ReferencePageResponseDto();
		dto.references = page.getContent()
				.stream()
				.map(mapperReference)
				.toList();
		dto.numeroPage = page.getNumber() + 1;
		dto.taillePage = page.getSize();
		dto.totalReferences = page.getTotalElements();
		dto.totalPages = page.getTotalPages();
		dto.premierElement = page.getTotalElements() == 0 ? 0L : page.getNumber() * (long) page.getSize() + 1;
		dto.dernierElement = page.getTotalElements() == 0 ? 0L : dto.premierElement + page.getNumberOfElements() - 1;
		return dto;
	}

}
