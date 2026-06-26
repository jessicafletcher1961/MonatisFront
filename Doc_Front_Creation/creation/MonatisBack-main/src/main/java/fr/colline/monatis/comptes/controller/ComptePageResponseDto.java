package fr.colline.monatis.comptes.controller;

import java.io.Serializable;
import java.util.List;

public class ComptePageResponseDto implements Serializable {

	private static final long serialVersionUID = 5520166672673723095L;

	public List<CompteResponseDto> comptes;
	public Integer numeroPage;
	public Integer taillePage;
	public Long totalComptes;
	public Integer totalPages;
	public Long premierElement;
	public Long dernierElement;

}
