package fr.colline.monatis.references.controller;

import java.io.Serializable;
import java.util.List;

public class ReferencePageResponseDto implements Serializable {

	private static final long serialVersionUID = 3358440637939239885L;

	public List<ReferenceResponseDto> references;
	public Integer numeroPage;
	public Integer taillePage;
	public Long totalReferences;
	public Integer totalPages;
	public Long premierElement;
	public Long dernierElement;

}
